from contextlib import redirect_stdout
import copy
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import credential_store
import gemini_agent as agent

TEST_KEY = "fixture-credential-not-a-real-key"


def response(model="gemini-3.1-pro-preview", answer="连接成功"):
    return {"model": model, "choices": [{"finish_reason": "stop", "message": {
        "role": "assistant", "content": answer, "reasoning_content": "private reasoning"}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 30, "total_tokens": 40,
                  "secret": "provider metadata", "completion_tokens_details": {"reasoning_tokens": 28}}}


class FakeClient:
    def __init__(self, replies=None):
        self._key = TEST_KEY
        self.calls = []
        self.replies = list(replies or [response(), response()])
        self.closed = False

    def request(self, path, timeout, payload=None):
        self.calls.append((path, timeout, copy.deepcopy(payload)))
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    def preflight(self, timeout, task=None):
        return {"ok": True}

    def close(self):
        self.closed = True
        self._key = ""


class FakeHTTPResponse:
    def __init__(self, value):
        self.value = value

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass

    def read(self, limit=-1):
        return self.value[:limit] if limit >= 0 else self.value


class AgentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="lsf-gemini-test-")
        self.root = Path(self.temp.name) / "中文 项目&$"
        self.root.mkdir()
        self.key_patch = patch.object(agent, "read_key", return_value=TEST_KEY)
        self.key_patch.start()

    def tearDown(self):
        self.key_patch.stop()
        self.temp.cleanup()

    def test_all_routes_pin_user_models_and_high_effort(self):
        expected = {"frontend": "gemini-3.1-pro-preview-thinking-high", "design": "gemini-3.1-pro-preview-thinking-high",
                    "copywriting": "gemini-3.1-pro-preview-thinking-high", "chat": "gemini-3.8-flash-thinking-high",
                    "complex": "gemini-4-argon"}
        for task, model in expected.items():
            with self.subTest(task=task):
                client = FakeClient([response(next(m for m in agent.REPORTED_MODELS[model] if "thinking" not in m))])
                result = agent.ApiSession(client, task, self.root).ask("检查", 5)
                payload = client.calls[0][2]
                self.assertEqual(payload["model"], model)
                self.assertEqual(payload["reasoning_effort"], "high")
                self.assertFalse(payload["stream"])
                self.assertNotIn("tools", payload)
                self.assertEqual(result["model_verification"], "provider_reported")

    def test_only_exact_base_family_alias_accepted(self):
        for model in (None, [], {}, "gemini-3-pro-preview", "gemini-3.8-flash", "claude-sonnet", "gemini-3.1-pro-preview-low"):
            with self.subTest(model=model):
                client = FakeClient([response(model)])
                session = agent.ApiSession(client, "frontend", self.root)
                with self.assertRaisesRegex(agent.AgentError, "模型"):
                    session.ask("检查", 5)
                self.assertTrue(session.closed)
                self.assertEqual(len(client.calls), 1)
                self.assertEqual(session.messages, [])

    def test_effort_mismatch_rejected(self):
        data = response()
        data["reasoning_effort"] = "low"
        with self.assertRaisesRegex(agent.AgentError, "思考"):
            agent.ApiSession(FakeClient([data]), "design", self.root).ask("检查", 5)

    def test_worker_retains_history_only_in_memory(self):
        client = FakeClient()
        session = agent.ApiSession(client, "design", self.root)
        first = session.ask("先看桌面", 5)
        second = session.ask("再看手机", 5)
        self.assertEqual(first["conversation_id"], second["conversation_id"])
        self.assertEqual([m["role"] for m in client.calls[1][2]["messages"]], ["system", "user", "assistant", "user"])
        self.assertEqual(client.calls[1][2]["messages"][1]["content"], "先看桌面")
        self.assertNotIn("private reasoning", json.dumps(client.calls[1][2]))
        session.close()
        self.assertEqual(session.messages, [])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_unicode_shell_chars_and_response_metadata(self):
        prompt = '雷师傅：“标题” & $HOME | <div> `代码` %PATH%\n第二行'
        client = FakeClient()
        result = agent.ApiSession(client, "design", self.root).ask(prompt, 5)
        self.assertEqual(client.calls[0][2]["messages"][-1]["content"], prompt)
        self.assertEqual(result["usage"]["reasoning_tokens"], 28)
        self.assertNotIn("private reasoning", json.dumps(result))
        self.assertNotIn("provider metadata", json.dumps(result))

    def test_incomplete_empty_or_tool_output_rejected_without_retry(self):
        variants = []
        for reason in ("length", "content_filter", "tool_calls", None):
            data = response()
            data["choices"][0]["finish_reason"] = reason
            variants.append(data)
        for answer in (None, "", " ", [], {}):
            variants.append(response(answer=answer))
        data = response()
        data["choices"][0]["message"]["tool_calls"] = [{"name": "danger"}]
        variants.append(data)
        variants += [{"model": "gemini-3.1-pro-preview", "choices": []}]
        for data in variants:
            with self.subTest(data=data):
                client = FakeClient([data])
                with self.assertRaises(agent.AgentError):
                    agent.ApiSession(client, "design", self.root).ask("检查", 5)
                self.assertEqual(len(client.calls), 1)

    def test_failed_call_closes_session_without_replaying_or_saving_history(self):
        client = FakeClient([agent.AgentError("测试超时")])
        session = agent.ApiSession(client, "design", self.root)
        with self.assertRaises(agent.AgentError):
            session.ask("检查", 5)
        with self.assertRaisesRegex(agent.AgentError, "关闭"):
            session.ask("重发", 5)
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(session.messages, [])

    def test_secrets_blocked_in_prompt_file_and_answer(self):
        file = self.root / "notes.txt"
        file.write_text(TEST_KEY, encoding="utf-8")
        with self.assertRaisesRegex(agent.AgentError, "密钥"):
            agent.build_prompt("检查", ["notes.txt"], self.root)
        client = FakeClient()
        with self.assertRaisesRegex(agent.AgentError, "密钥"):
            agent.ApiSession(client, "design", self.root).ask(TEST_KEY, 5)
        self.assertEqual(client.calls, [])
        with self.assertRaisesRegex(agent.AgentError, "凭据"):
            agent.ApiSession(FakeClient([response(answer=TEST_KEY)]), "design", self.root).ask("检查", 5)

    def test_context_utf8_boundary_secret_binary_and_size(self):
        (self.root / "组件.tsx").write_text("const label='雷师傅';", encoding="utf-8")
        self.assertIn("const label", agent.build_prompt("对齐", ["组件.tsx"], self.root))
        outside = self.root.parent / "outside.txt"
        outside.write_text("outside", encoding="utf-8")
        with self.assertRaisesRegex(agent.AgentError, "原项目"):
            agent.build_prompt("任务", [str(outside)], self.root)
        for name in (".env.local", "密钥.txt", "oauth_creds.json", "certificate.pem", "api_key"):
            (self.root / name).write_text("fixture", encoding="utf-8")
            with self.subTest(name=name), self.assertRaisesRegex(agent.AgentError, "敏感"):
                agent.build_prompt("任务", [name], self.root)
        (self.root / "binary.txt").write_bytes(b"a\x00b")
        with self.assertRaises(agent.AgentError):
            agent.build_prompt("任务", ["binary.txt"], self.root)
        with self.assertRaisesRegex(agent.AgentError, "2 MiB"):
            agent.build_prompt("a" * (agent.MAX_CONTEXT_BYTES + 1), [], self.root)

    def test_symlink_escape_rejected(self):
        outside = self.root.parent / "outside.txt"
        outside.write_text("outside", encoding="utf-8")
        link = self.root / "link.txt"
        try:
            link.symlink_to(outside)
        except OSError:
            self.skipTest("Windows session cannot create symlinks")
        with self.assertRaisesRegex(agent.AgentError, "原项目"):
            agent.build_prompt("任务", ["link.txt"], self.root)

    def test_screenshot_pixels_attached_and_non_image_rejected(self):
        image = self.root / "screen.png"
        image.write_bytes(b"\x89PNG\r\n\x1a\nfixture-pixels")
        client = FakeClient()
        agent.ApiSession(client, "design", self.root).ask("看截图", 5, ["screen.png"])
        content = client.calls[0][2]["messages"][-1]["content"]
        self.assertTrue(content[1]["image_url"]["url"].startswith("data:image/png;base64,"))
        (self.root / "fake.png").write_text("just a path", encoding="utf-8")
        with self.assertRaisesRegex(agent.AgentError, "真实"):
            agent.user_content("看图", ["fake.png"], self.root)

    def test_model_preflight_caches_metadata_but_does_not_claim_generation(self):
        with patch.object(agent, "proxy_settings", return_value={}):
            client = agent.ApiClient()
        models = {"data": [{"id": m} for m in set(agent.ROUTES.values())]}
        with patch.object(client, "request", return_value=models) as call:
            self.assertFalse(client.preflight(5)["generation_verified"])
            client.preflight(5, "design")
            self.assertEqual(call.call_count, 1)
        models["data"] = [{"id": "gemini-3.1-pro-preview-thinking-*"}]
        client._models = None
        with patch.object(client, "request", return_value=models), self.assertRaisesRegex(agent.AgentError, "未列出"):
            client.preflight(5, "design")

    def test_request_is_https_pinned_and_keeps_key_out_of_body(self):
        with patch.object(agent, "proxy_settings", return_value={}):
            client = agent.ApiClient()
        reqs = []
        def open_request(request, timeout):
            reqs.append(request)
            return FakeHTTPResponse(json.dumps(response()).encode())
        with patch.object(client.opener, "open", side_effect=open_request):
            client.request("/chat/completions", 5, {"model": "fixed"})
        self.assertEqual(reqs[0].full_url, "https://ai.t8star.org/v1/chat/completions")
        self.assertEqual(reqs[0].get_header("Authorization"), "Bearer " + TEST_KEY)
        self.assertNotIn(TEST_KEY, reqs[0].data.decode())
        with self.assertRaises(agent.AgentError):
            client.request("https://other.example", 5)
        handler = agent.NoRedirect()
        self.assertIsNone(handler.redirect_request(reqs[0], None, 307, "", {}, "https://other.example"))
        client.close()
        self.assertEqual(client._key, "")

    def test_api_error_timeout_and_malformed_response_are_safe_no_retry(self):
        with patch.object(agent, "proxy_settings", return_value={}):
            client = agent.ApiClient()
        for status, data, expected in (
            (503, {"error": {"code": "model_not_found", "message": TEST_KEY}}, "渠道"),
            (403, {"error": {"message": "quota " + TEST_KEY}}, "额度"),
            (401, {"error": {"message": TEST_KEY}}, "密钥"),
            (429, {}, "限流"), (302, {}, "重定向"), (500, {}, "HTTP 500"),
        ):
            error = urllib.error.HTTPError(agent.BASE_URL, status, "private detail", {}, io.BytesIO(json.dumps(data).encode()))
            with self.subTest(status=status), patch.object(client.opener, "open", side_effect=error) as call:
                with self.assertRaisesRegex(agent.AgentError, expected) as caught:
                    client.request("/models", 5)
                self.assertNotIn(TEST_KEY, str(caught.exception))
                self.assertEqual(call.call_count, 1)
        with patch.object(client.opener, "open", side_effect=TimeoutError()), self.assertRaisesRegex(agent.AgentError, "超时"):
            client.request("/models", 5)
        for value in (b"not-json", b"[]", b'\xff', json.dumps(response()).encode('utf-16')):
            with patch.object(client.opener, "open", return_value=FakeHTTPResponse(value)), self.assertRaises(agent.AgentError):
                client.request("/models", 5)

    def test_existing_proxy_used_without_system_changes(self):
        with patch.dict(os.environ, {"HTTPS_PROXY": "http://user-proxy:8888"}, clear=True), \
             patch.object(agent, "windows_proxy", return_value="127.0.0.1:7890"):
            self.assertEqual(agent.proxy_settings()["https"], "http://user-proxy:8888")
            self.assertNotIn("HTTP_PROXY", os.environ)
        with patch.dict(os.environ, {}, clear=True), patch.object(agent, "windows_proxy", return_value="127.0.0.1:7890"):
            self.assertEqual(agent.proxy_settings()["https"], "http://127.0.0.1:7890")
            self.assertNotIn("HTTPS_PROXY", os.environ)

    def test_worker_two_turns_and_close(self):
        client = FakeClient()
        source = '\n'.join(json.dumps(req, ensure_ascii=False) for req in (
            {"id": "one", "prompt": "桌面"}, {"id": "two", "prompt": "手机"}, {"op": "close"}))
        output = io.StringIO()
        with patch.object(sys, "argv", ["agent", "worker", "--task", "design", "--cwd", str(self.root)]), \
             patch.object(sys, "stdin", io.StringIO(source)), patch.object(agent, "ApiClient", return_value=client), \
             redirect_stdout(output):
            self.assertEqual(agent.main(), 0)
        events = [json.loads(line) for line in output.getvalue().splitlines()]
        results = [event for event in events if event["event"] == "result"]
        self.assertEqual([item["id"] for item in results], ["one", "two"])
        self.assertEqual(results[0]["conversation_id"], results[1]["conversation_id"])
        self.assertEqual(len(client.calls[1][2]["messages"]), 4)
        self.assertTrue(client.closed)

    def test_worker_cannot_override_routing_or_project(self):
        for request in ({"id": "x", "prompt": "任务", "task": "complex"},
                        {"id": "x", "prompt": "任务", "model": "anything"},
                        {"id": "x", "prompt": "任务", "cwd": "elsewhere"}):
            client = FakeClient()
            with patch.object(sys, "argv", ["agent", "worker", "--task", "design", "--cwd", str(self.root)]), \
                 patch.object(sys, "stdin", io.StringIO(json.dumps(request))), patch.object(agent, "ApiClient", return_value=client), \
                 redirect_stdout(io.StringIO()):
                self.assertEqual(agent.main(), 1)
            self.assertEqual(client.calls, [])

    def test_credential_environment_read_without_vault_or_disk(self):
        with patch.dict(os.environ, {"T8STAR_API_KEY": TEST_KEY}, clear=True), patch.object(credential_store, "vault") as vault:
            self.assertEqual(credential_store.read_key(), TEST_KEY)
            vault.assert_not_called()


if __name__ == "__main__":
    unittest.main()
