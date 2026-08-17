# -*- coding: utf-8 -*-
"""
日/夜 Logo 资产管线(用户定稿成品,直接使用,不做二次合成):
- docs/design/brand/日间logo.png(白字黑底)→ apps/web/public/brand/logo-day.png
- docs/design/brand/夜间logo.png(黑字白底)→ apps/web/public/brand/logo-night.png
- 日间图缩至 256px → apps/web/app/icon.png(favicon)

运行: python tools/brand/process_logo.py
"""
import os, sys, io, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from PIL import Image

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SOURCE = os.path.join(REPO_ROOT, 'docs', 'design', 'brand')
PUBLIC_BRAND = os.path.join(REPO_ROOT, 'apps', 'web', 'public', 'brand')
APP = os.path.join(REPO_ROOT, 'apps', 'web', 'app')

def main():
    pairs = [('日间logo.png', 'logo-day.png'), ('夜间logo.png', 'logo-night.png')]
    for src_name, dst_name in pairs:
        dst = os.path.join(PUBLIC_BRAND, dst_name)
        shutil.copyfile(os.path.join(SOURCE, src_name), dst)
        print('apps/web/public/brand/' + dst_name, os.path.getsize(dst), 'bytes')

    # favicon(日间版,256px 足够)
    icon = Image.open(os.path.join(SOURCE, '日间logo.png'))
    icon.thumbnail((256, 256), Image.LANCZOS)
    icon.save(os.path.join(APP, 'icon.png'))
    print('apps/web/app/icon.png', os.path.getsize(os.path.join(APP, 'icon.png')), 'bytes')

if __name__ == '__main__':
    main()
