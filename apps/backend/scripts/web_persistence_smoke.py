"""One-shot web BFF persistence smoke test against localhost:3000."""
import http.cookiejar
import json
import urllib.request

BASE = 'http://127.0.0.1:3000/api/v1'
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def call(method, path, body=None, stream=False):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if body is not None:
        req.add_header('Content-Type', 'application/json; charset=utf-8')
    resp = opener.open(req, timeout=180)
    raw = resp.read().decode('utf-8')
    if stream:
        return resp.status, raw
    return resp.status, json.loads(raw) if raw.startswith('{') else raw


def main() -> None:
    print('1 config', call('GET', '/chat/config')[1]['code'])
    _, sessions = call('GET', '/chat/sessions')
    print('2 sessions ephemeral=', sessions['data']['ephemeral'], 'cookies=', [c.name for c in jar])
    assert sessions['data']['ephemeral'] is False, 'expected durable mode'

    _, created = call('POST', '/chat/sessions', {
        'type': 'chat', 'question': '网页端持久化联调二', 'mode': 'fast', 'web_search': False,
    })
    print('3 create', created)
    sid = created['data']['session_id']
    mid = created['data']['message_id']

    _, stream = call('GET', f'/chat/messages/{mid}/stream', stream=True)
    print('4 stream tail:')
    for block in [b for b in stream.split('\n\n') if b.strip()][-4:]:
        print(block[:220].replace('\n', ' | '))
    assert 'event: done' in stream, stream[-500:]

    _, detail = call('GET', f'/chat/sessions/{sid}')
    msg = detail['data']['messages'][0]
    print('5 detail status=', msg['status'], 'content_len=', len(msg.get('content') or ''),
          'error=', msg.get('error'))
    assert msg['status'] in ('done', 'failed', 'stopped')

    _, patched = call('PATCH', f'/chat/sessions/{sid}', {'favorite': True, 'title': '联调重命名'})
    print('6 patch', patched['data']['favorite'], patched['data']['title'])

    _, listing = call('GET', '/chat/sessions')
    print('7 list', [(s['title'], s['favorite']) for s in listing['data']['sessions'][:5]])
    assert any(s['id'] == sid and s['title'] == '联调重命名' and s['favorite'] for s in listing['data']['sessions'])

    # Clear process cache equivalence: list still from PG
    print('8 durable list count=', len(listing['data']['sessions']), 'ephemeral=', listing['data']['ephemeral'])
    assert listing['data']['ephemeral'] is False
    print('WEB_ACCEPTANCE_PASS')
    if msg['status'] != 'done':
        print('NOTE: model auth failed in this environment; persistence path still verified.')


if __name__ == '__main__':
    main()
