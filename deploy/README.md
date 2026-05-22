# ScriptStack Deployment Guide

## 目录结构（服务器上）
```
/opt/scriptstack/
├── scriptstack-server     # 编译好的二进制
├── .env                   # 环境变量配置
├── data/
│   ├── scriptstack.db     # SQLite 数据库（自动创建）
│   └── uploads/           # 用户上传的文件
└── dist/                  # 前端构建产物（由 nginx 直接托管）
```

## 1. 编译二进制

```bash
# 在开发机上交叉编译（或在服务器上直接编译）
cd src-server
cargo build --release
# 产物在 target/release/scriptstack-server
```

## 2. 配置环境变量

```bash
cp src-server/.env.example /opt/scriptstack/.env
# 编辑 .env，填入 JWT_SECRET、LLM API KEY 等
```

## 3. systemd 服务

```bash
sudo cp deploy/scriptstack.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable scriptstack
sudo systemctl start scriptstack
sudo systemctl status scriptstack
```

## 4. Nginx 反代 + HTTPS

```bash
sudo cp deploy/scriptstack.nginx.conf /etc/nginx/sites-available/scriptstack
sudo ln -s /etc/nginx/sites-available/scriptstack /etc/nginx/sites-enabled/
sudo certbot --nginx -d yourdomain.com
sudo nginx -t && sudo systemctl reload nginx
```

## 5. 前端部署

```bash
cd frontend-src
npm run build
# 将 dist/ 目录内容复制到服务器 /opt/scriptstack/dist/
rsync -avz ../dist/ user@server:/opt/scriptstack/dist/
```

## 6. Tauri 客户端配置

修改 Tauri 客户端的 WebView URL 指向你的域名：
```
VITE_API_BASE=https://yourdomain.com
```

然后重新构建 Tauri 桌面客户端。
