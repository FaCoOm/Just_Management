"""
Reverse-proxy bridge: Uvicorn (port 8001) → Express/Prisma (port 3001).
Supervisor manages this process; the real Node backend runs separately.
"""

import os
import subprocess
import signal
import sys
import asyncio
import httpx
from fastapi import FastAPI, Request, Response
from starlette.background import BackgroundTask

EXPRESS_PORT = os.environ.get("EXPRESS_PORT", "3001")
EXPRESS_URL = f"http://127.0.0.1:{EXPRESS_PORT}"

node_proc = None

def start_express():
    global node_proc
    env = {**os.environ, "PORT": EXPRESS_PORT}
    node_proc = subprocess.Popen(
        ["node_modules/.bin/tsx", "watch", "src/index.ts"],
        cwd="/app/backend",
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )

def stop_express(*_args):
    global node_proc
    if node_proc and node_proc.poll() is None:
        node_proc.terminate()
        try:
            node_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            node_proc.kill()

signal.signal(signal.SIGTERM, stop_express)
signal.signal(signal.SIGINT, stop_express)

app = FastAPI()

@app.on_event("startup")
async def on_startup():
    start_express()
    for _ in range(30):
        try:
            async with httpx.AsyncClient() as c:
                r = await c.get(f"{EXPRESS_URL}/health", timeout=2)
                if r.status_code == 200:
                    print(f"Express backend ready on port {EXPRESS_PORT}")
                    return
        except Exception:
            pass
        await asyncio.sleep(1)
    print("Warning: Express backend did not respond within 30s")

@app.on_event("shutdown")
async def on_shutdown():
    stop_express()

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    url = f"{EXPRESS_URL}/{path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"

    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                content=body,
            )
            excluded = {"transfer-encoding", "content-encoding", "content-length"}
            resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in excluded}
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=resp_headers,
            )
    except httpx.ConnectError:
        return Response(content='{"error":"Backend not ready"}', status_code=503, media_type="application/json")
    except httpx.TimeoutException:
        return Response(content='{"error":"Backend timeout"}', status_code=504, media_type="application/json")
