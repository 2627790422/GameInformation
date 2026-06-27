import base64, json, urllib.request, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = 'e:/TryAI/GameInformation/web-viewer/docs/plans/toggle-redesign'
API_KEY = 'fb4b7ecf506d4b2297880673739b50ff.YfhFnNBGwQCpoqFe'

def vision(path, prompt):
    url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    with open(path, 'rb') as f:
        img_b64 = base64.b64encode(f.read()).decode('utf-8')
    data = json.dumps({
        'model': 'glm-4.6v',
        'messages': [{
            'role': 'user',
            'content': [
                {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{img_b64}'}},
                {'type': 'text', 'text': prompt}
            ]
        }],
        'max_tokens': 600,
        'thinking': {'type': 'disabled'}
    }).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    })
    resp = urllib.request.urlopen(req, timeout=180)
    result = json.loads(resp.read().decode('utf-8'))
    return result['choices'][0]['message']['content']

results = []

tests = [
    ('screenshot-1-ai-active.png', 'Describe briefly: at the top of the page, are there two pill buttons showing "游 戏" and "A I"? Are BOTH always visible? Which one has the accent color fill (brick red)? Reply in English.'),
    ('screenshot-2-games-active.png', 'After clicking "游 戏" button: is the "游 戏" pill now filled with accent/brick-red color? Did the article list below change to games-related content (with pipeline tags like 微信资讯, 游戏跟踪, 设计管线)? Reply in English.'),
    ('screenshot-3-detail-hidden.png', 'This is an article reading page. Is there NO module toggle bar with "游 戏"/"A I" pills at the very top of the page? Is the page showing article content with a "返回列表" back button? Reply in English.'),
]

for fname, prompt in tests:
    path = f'{BASE}/{fname}'
    print(f'\n=== {fname} ===')
    try:
        result = vision(path, prompt)
        print(result)
        results.append((fname, result))
    except Exception as e:
        print(f'ERROR: {e}')
        results.append((fname, f'ERROR: {e}'))

# Also save to file
with open(f'{BASE}/vision_verify_results.txt', 'w', encoding='utf-8') as f:
    for fname, result in results:
        f.write(f'\n=== {fname} ===\n')
        f.write(result + '\n')
