"""Store this skill's T8Star key in the current user's Windows credential vault."""
from __future__ import annotations

import ctypes
from ctypes import wintypes
import getpass
import json
import os
import sys

TARGET = "LSF-Gemini-Agent:T8Star"


class CredentialError(Exception):
    pass


class CREDENTIALW(ctypes.Structure):
    _fields_ = [
        ("Flags", wintypes.DWORD), ("Type", wintypes.DWORD),
        ("TargetName", wintypes.LPWSTR), ("Comment", wintypes.LPWSTR),
        ("LastWritten", wintypes.FILETIME), ("CredentialBlobSize", wintypes.DWORD),
        ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
        ("Persist", wintypes.DWORD), ("AttributeCount", wintypes.DWORD),
        ("Attributes", ctypes.c_void_p), ("TargetAlias", wintypes.LPWSTR),
        ("UserName", wintypes.LPWSTR),
    ]


def vault():
    if os.name != "nt":
        raise CredentialError("此凭据入口仅支持 Windows；其他平台使用进程环境变量 T8STAR_API_KEY")
    lib = ctypes.WinDLL("advapi32", use_last_error=True)
    lib.CredWriteW.argtypes = [ctypes.POINTER(CREDENTIALW), wintypes.DWORD]
    lib.CredWriteW.restype = wintypes.BOOL
    lib.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                            ctypes.POINTER(ctypes.POINTER(CREDENTIALW))]
    lib.CredReadW.restype = wintypes.BOOL
    lib.CredFree.argtypes = [ctypes.c_void_p]
    lib.CredFree.restype = None
    return lib


def save_key(value: str) -> None:
    value = value.strip()
    if not value or len(value.encode("utf-8")) > 2560 or any(c.isspace() for c in value):
        raise CredentialError("密钥为空或格式无效")
    encoded = value.encode("utf-8")
    blob = (ctypes.c_ubyte * len(encoded)).from_buffer_copy(encoded)
    cred = CREDENTIALW(Type=1, TargetName=TARGET, Comment="LSF Gemini via ai.t8star.org",
                       CredentialBlobSize=len(encoded), CredentialBlob=blob,
                       Persist=2, UserName="T8Star API")
    try:
        if not vault().CredWriteW(ctypes.byref(cred), 0):
            raise CredentialError("Windows 凭据管理器保存失败")
    finally:
        ctypes.memset(blob, 0, len(encoded))


def read_key() -> str:
    explicit = os.environ.get("T8STAR_API_KEY", "").strip()
    if explicit:
        return explicit
    pointer = ctypes.POINTER(CREDENTIALW)()
    lib = vault()
    if not lib.CredReadW(TARGET, 1, 0, ctypes.byref(pointer)):
        raise CredentialError("尚未设置 T8Star 密钥；运行 credential_store.py --set 安全输入")
    try:
        cred = pointer.contents
        value = ctypes.string_at(cred.CredentialBlob, cred.CredentialBlobSize).decode("utf-8")
        if not value.strip():
            raise CredentialError("保存的密钥为空")
        return value
    finally:
        lib.CredFree(pointer)


def main():
    try:
        if sys.argv[1:] == ["--set"]:
            save_key(getpass.getpass("T8Star API key (hidden): "))
        elif sys.argv[1:] != ["--status"]:
            raise CredentialError("使用 --set 安全输入，或 --status 只检查是否存在")
        # Confirm readable without printing the key, prefix, length or fingerprint.
        read_key()
        print(json.dumps({"ok": True, "credential_store": "Windows Credential Manager",
                          "target": TARGET, "key_present": True}, ensure_ascii=False))
        return 0
    except (CredentialError, UnicodeError, EOFError):
        print(json.dumps({"ok": False, "error": "凭据操作失败；密钥未回显"}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
