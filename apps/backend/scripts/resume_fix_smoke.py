"""Reproduce/fix resume after PG reload (failed message not in memory)."""
import http.cookiejar
import json
import urllib.request

BASE = 'http://127.0.0.1:3000/api/v1'
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def call(method, path, body=None):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if body is not None:
        req.add_header('Content-Type', 'application/json; charset=utf-8')
    with opener.open(req, timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8'))


def main() -> None:
    call('GET', '/chat/sessions')
    created = call('POST', '/chat/sessions', {
        'type': 'chat', 'question': 'resume修复验证', 'mode': 'fast', 'web_search': False,
    })['data']
    mid = created['message_id']
    # Force failed without stream: stop before generate
    stop = call('POST', f'/chat/messages/{mid}/stop')
    print('stop', stop)
    # Resume should be 200, not 500
    resumed = call('POST', f'/chat/messages/{mid}/resume')
    print('resume', resumed)
    assert resumed['code'] == 0, resumed
    assert resumed['data']['message_id'] == mid
    print('RESUME_FIX_PASS')


if __name__ == '__main__':
    main()
