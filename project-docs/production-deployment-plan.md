# 海外 VPS 上线方案

## 1. 方案结论

本项目第一版推荐部署到海外 VPS，而不是中国内地服务器，也不是直接照搬纯前端的 Vercel/Cloudflare Pages 免费部署方案。当前代码已经支持独立下载 GDELT 2.0 Events export 文件，因此生产环境不再必须依赖 MapNews 的每日导入流程。

推荐默认链路：

```text
国内购买 .com 域名
  -> Cloudflare 接管 DNS
  -> 灰云 DNS-only A 记录指向海外 VPS
  -> VPS 上 Nginx 接收 80/443
  -> Nginx 反向代理到 Next.js
  -> Next.js API 读取 PostgreSQL 关系产品缓存
  -> Python 任务按计划刷新缓存
```

第一阶段可以先不买域名，直接用 VPS 公网 IP 验收：

```text
http://VPS_IP
```

域名、HTTPS 和自动部署都可以在 Web 服务跑通后再接入。

## 2. 当前项目部署特点

本项目不是纯静态网站。它包含以下运行部分：

| 部分 | 说明 |
| --- | --- |
| Next.js Web/API | 前台页面和 `/api/trend`、`/api/ai/explanation` |
| PostgreSQL | 读取关系趋势缓存，也可保存精简 GDELT 切片 |
| Python 任务 | 独立导入 GDELT export 文件、预计算关系温度、补充 AI 解读、写入缓存 |
| 定时任务 | 每日刷新缓存 |
| Nginx | 对外提供 80/443，反向代理到 Next.js |
| HTTPS 证书 | 推荐由 Let's Encrypt/Certbot 在 VPS 上签发 |

因此，Cloudflare Pages 这类纯静态托管不适合作为当前项目的主部署方式。Vercel 可以部署 Next.js，但当前代码里有 Node API 调用 Python 子进程的逻辑，放到 VPS 或容器里更自然。

## 3. 服务器选择

### 3.1 推荐配置

当前可先使用已有 DediOne 特价 VPS：

```text
1 CPU / 1GB RAM / 20GB SSD / China Direct Optimized
```

它适合 MVP 验证，但必须加 swap。若构建或运行吃紧，升级到：

```text
2 CPU / 2GB RAM / 40GB SSD / China Direct Optimized
```

### 3.2 资源判断

截至 2026-06-03，本地数据库统计：

| 项目 | 规模 |
| --- | ---: |
| `mapnews` 数据库总大小 | 约 100GB |
| `gdelt_mentions_clean` | 约 72GB |
| `gdelt_events_clean` | 约 21GB |
| 最新 90 天项目相关事件 | 约 47 万行 |
| 最新 90 天项目相关事件原始行大小 | 约 175MB |
| 全部日期项目相关事件原始行大小 | 约 645MB |
| 关系产品缓存表 | MB 级 |

结论：

- 不要把完整 MapNews 数据库搬到 20-40GB VPS。
- 20GB 足够部署 Web 服务和缓存表。
- 40GB 更适合同时放精简 GDELT 事件切片。
- `gdelt_mentions_clean` 当前产品不读取，不应迁移到 VPS。

## 4. 数据部署策略

上线数据有三种可选模式。第一版如果希望最快上线，可用模式 A；如果希望 VPS 独立运行每日刷新，推荐模式 B。

### 4.1 模式 A：缓存表模式，推荐 MVP

VPS 上只保存关系产品缓存表：

```text
relationship_trend_cache
relationship_report_metadata
relationship_ai_explanation_cache
```

特点：

- VPS 数据占用最小。
- 线上 API 查询很快。
- 不需要把 GDELT 大表搬到 VPS。
- 每日刷新不能完全在 VPS 上独立完成，需要在本地完整数据库或另一台数据机器上跑预计算，再同步缓存表到 VPS。

适用场景：

- 第一版上线。
- 流量不大。
- 先验证产品体验、域名、HTTPS、访问速度。

本地或数据机器刷新流程：

```bash
.venv/bin/python -m relationship_temperature.precompute --with-ai
```

同步缓存表到生产库的示例：

```bash
pg_dump "$LOCAL_DATABASE_URL" \
  --data-only \
  --table relationship_trend_cache \
  --table relationship_report_metadata \
  --table relationship_ai_explanation_cache \
  --file relationship-cache.sql

psql "$PRODUCTION_DATABASE_URL" <<'SQL'
truncate relationship_ai_explanation_cache;
truncate relationship_report_metadata;
truncate relationship_trend_cache;
SQL

psql "$PRODUCTION_DATABASE_URL" -f relationship-cache.sql
```

注意：如果生产库和本地库不在同一台机器，以上命令应在能同时访问两个数据库的位置执行。

### 4.2 模式 B：独立 GDELT 导入模式，推荐生产

VPS 上保存：

```text
relationship_trend_cache
relationship_report_metadata
relationship_ai_explanation_cache
relationship_gdelt_import_files
gdelt_events_clean
```

本项目会直接从 GDELT 2.0 下载 `*.export.CSV.zip`，只导入候选国家代码之间的事件，不导入 mentions/gkg。

导入并刷新缓存：

```bash
cd /var/www/relationship-temperature
.venv/bin/python -m relationship_temperature.gdelt_importer \
  --wait-for-files \
  --precompute \
  --with-ai \
  --prune-days 120
```

说明：

- 默认导入 UTC 昨日的 96 个 15 分钟 export 文件。
- `--prune-days 120` 会从最新事件日期往前保留 120 天事件，控制 VPS 磁盘占用。
- `--precompute` 会在导入后更新关系产品缓存。
- `--with-ai` 会补充重点关系趋势段 AI 解读。
- 测试时可以加 `--limit-files 2`，避免一次导入全天数据。

首次回填最近 90 天时，可以按天循环执行：

```bash
for day in $(seq 0 89); do
  import_date="$(date -u -d "2026-06-02 - ${day} days" '+%Y-%m-%d')"
  .venv/bin/python -m relationship_temperature.gdelt_importer \
    --date "$import_date" \
    --prune-days 120
done

.venv/bin/python -m relationship_temperature.precompute --with-ai
```

macOS 本地回填命令中的 `date -d` 需要改成 BSD `date -v` 写法；VPS Ubuntu 可直接使用上面的命令。

### 4.3 模式 C：手工精简 GDELT 切片模式

VPS 上保存：

```text
relationship_trend_cache
relationship_report_metadata
relationship_ai_explanation_cache
gdelt_events_clean 的项目相关切片
```

只迁移候选国家代码之间、最新 90 或 180 天、项目实际读取的字段。

项目读取字段包括：

```text
event_date
actor1_country_code
actor2_country_code
goldstein_scale
num_mentions
num_articles
event_code
event_root_code
quad_class
actor1_name
actor2_name
source_domain
source_url
```

候选国家代码来自 `config/candidate-pool.json`：

```text
CHN, USA, RUS, EUR, GBR, DEU, FRA, ITA, ESP, NLD, JPN, IND, IRN, TWN, UKR
```

精简切片导出示例：

```sql
\copy (
  with code_map(code) as (
    values
      ('CHN'), ('USA'), ('RUS'), ('EUR'), ('GBR'), ('DEU'), ('FRA'),
      ('ITA'), ('ESP'), ('NLD'), ('JPN'), ('IND'), ('IRN'), ('TWN'), ('UKR')
  ),
  latest as (
    select max(event_date) as max_date from gdelt_events_clean
  )
  select
    e.event_date,
    e.actor1_country_code,
    e.actor2_country_code,
    e.goldstein_scale,
    e.num_mentions,
    e.num_articles,
    e.event_code,
    e.event_root_code,
    e.quad_class,
    e.actor1_name,
    e.actor2_name,
    e.source_domain,
    e.source_url
  from gdelt_events_clean e
  join code_map a on a.code = e.actor1_country_code
  join code_map b on b.code = e.actor2_country_code
  cross join latest
  where e.event_date between latest.max_date - interval '89 days' and latest.max_date
    and e.goldstein_scale is not null
    and e.actor1_country_code is not null
    and e.actor2_country_code is not null
    and e.actor1_country_code <> e.actor2_country_code
) to 'gdelt_events_clean_90d.csv' csv header;
```

生产库导入前可创建兼容表：

```sql
create table if not exists gdelt_events_clean (
  event_date date,
  actor1_country_code text,
  actor2_country_code text,
  goldstein_scale double precision,
  num_mentions integer,
  num_articles integer,
  event_code text,
  event_root_code text,
  quad_class integer,
  actor1_name text,
  actor2_name text,
  source_domain text,
  source_url text
);

create index if not exists gdelt_events_clean_relationship_idx
  on gdelt_events_clean (event_date, actor1_country_code, actor2_country_code)
  where goldstein_scale is not null;
```

导入示例：

```sql
truncate gdelt_events_clean;

\copy gdelt_events_clean (
  event_date,
  actor1_country_code,
  actor2_country_code,
  goldstein_scale,
  num_mentions,
  num_articles,
  event_code,
  event_root_code,
  quad_class,
  actor1_name,
  actor2_name,
  source_domain,
  source_url
) from 'gdelt_events_clean_90d.csv' csv header;
```

如果使用手工切片模式，建议用下面命令刷新，而不是直接运行 `scheduled_refresh`：

```bash
.venv/bin/python -m relationship_temperature.precompute --with-ai
```

只有继续复用 MapNews，并且生产库也维护了 `gdelt_import_batches` 时，才使用：

```bash
.venv/bin/python -m relationship_temperature.scheduled_refresh
```

## 5. 域名、DNS 和 HTTPS

### 5.1 国内域名和海外服务器

可以在阿里云、腾讯云等国内注册商购买 `.com` 域名。是否需要 ICP 备案，关键不在域名在哪里买，而在网站是否托管在中国内地服务器或中国内地 CDN 节点。

本方案中服务器位于海外，因此第一版不走中国内地 ICP 备案流程。

### 5.2 Cloudflare 接管 DNS

Cloudflare 的作用是管理域名解析：

```text
example.com -> VPS 公网 IP
www.example.com -> example.com
```

推荐初始配置：

| 记录 | 类型 | 值 | Cloudflare 状态 |
| --- | --- | --- | --- |
| `example.com` | A | `VPS_IP` | 灰云 DNS-only |
| `www.example.com` | CNAME | `example.com` | 灰云 DNS-only |

灰云和橙云的区别：

| 模式 | 访问链路 | 适合当前项目吗 |
| --- | --- | --- |
| 灰云 DNS-only | 用户直接访问 VPS | 推荐默认使用 |
| 橙云 Proxied | 用户先访问 Cloudflare，再转发到 VPS | 后续按测试结果决定 |

当前 DediOne VPS 是 CN 优化线路，灰云可以让用户直接走 VPS 线路。免费 Cloudflare 橙云不一定提升大陆访问速度，甚至可能绕路。

### 5.3 HTTPS 证书

DNS 只负责把域名指向 IP。HTTPS 证书默认安装在 VPS 上，由 Nginx 使用。

域名解析完成后执行：

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

Certbot 会：

- 验证域名确实指向 VPS。
- 申请 Let's Encrypt 免费证书。
- 更新 Nginx 配置。
- 配置自动续期。

没有域名时，先用 HTTP IP 访问即可：

```text
http://VPS_IP
```

不建议用 IP 直接做正式 HTTPS。

### 5.4 多域名

多个域名可以同时指向同一台 VPS：

```text
domain-a.com -> VPS_IP
domain-b.com -> VPS_IP
```

同一个项目可在 Nginx 中写多个 `server_name`：

```nginx
server_name domain-a.com www.domain-a.com domain-b.com;
```

如果多个域名对应不同项目，则让不同 Nginx `server` 块反向代理到不同本地端口。

## 6. VPS 初始化

以下命令以 Ubuntu 24.04 LTS 为默认系统。若系统不同，需要按实际发行版调整包管理命令。

### 6.1 创建 swap

1GB 内存 VPS 必做：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### 6.2 安装系统依赖

```bash
sudo apt update
sudo apt install -y \
  git \
  curl \
  nginx \
  certbot \
  python3-certbot-nginx \
  python3.12 \
  python3.12-venv \
  python3-pip \
  postgresql-client \
  ufw
```

安装 Node.js。推荐 Node.js 22 LTS；如果系统仓库版本过旧，可使用 NodeSource 或 nvm。

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

node -v
npm -v
```

### 6.3 防火墙

只开放 SSH、HTTP、HTTPS：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Next.js 只监听 `127.0.0.1:3000`，不要直接暴露公网 3000 端口。

## 7. 项目部署

### 7.1 拉取代码

```bash
sudo mkdir -p /var/www
sudo chown "$USER":"$USER" /var/www
cd /var/www

git clone git@github.com:YOUR_ORG/YOUR_REPO.git relationship-temperature
cd relationship-temperature
```

如果是私有仓库，需要在 VPS 上配置 deploy key 或可读取仓库的 SSH key。

### 7.2 安装依赖

```bash
npm ci

python3.12 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e .
```

### 7.3 配置环境变量

生产环境变量建议放在 systemd 环境文件：

```bash
sudo nano /etc/relationship-temperature.env
```

内容模板：

```text
NODE_ENV=production
GDELT_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
PYTHON_BIN=/var/www/relationship-temperature/.venv/bin/python
```

权限：

```bash
sudo chmod 600 /etc/relationship-temperature.env
```

不要把真实密钥提交到 Git。

### 7.4 初始化生产数据库

先创建关系产品表：

```bash
psql "$GDELT_DATABASE_URL" -f migrations/001_relationship_cache.sql
psql "$GDELT_DATABASE_URL" -f migrations/002_ai_enrichment.sql
```

如果使用缓存表模式，从本地或数据机器同步缓存表到生产库。

如果使用独立 GDELT 导入模式，直接执行：

```bash
.venv/bin/python -m relationship_temperature.gdelt_importer --wait-for-files --wait-timeout-minutes 120 --precompute --with-ai --prune-days 120
```

如果使用手工精简 GDELT 切片模式，先导入 `gdelt_events_clean` 精简切片，再执行：

```bash
.venv/bin/python -m relationship_temperature.precompute --with-ai
```

### 7.5 构建 Next.js

```bash
npm run build
```

当前 `package.json` 没有 `start` 脚本。部署时可直接使用：

```bash
npm exec -- next start -H 127.0.0.1 -p 3000
```

也可以后续在 `package.json` 增加：

```json
"start": "next start"
```

## 8. systemd 常驻服务

创建服务文件：

```bash
sudo nano /etc/systemd/system/relationship-temperature.service
```

内容：

```ini
[Unit]
Description=Relationship Temperature Next.js app
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/var/www/relationship-temperature
EnvironmentFile=/etc/relationship-temperature.env
ExecStart=/usr/bin/npm exec -- next start -H 127.0.0.1 -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

如果实际部署用户不是 `deploy`，把 `User` 和 `Group` 改成实际用户名。

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable relationship-temperature
sudo systemctl start relationship-temperature
sudo systemctl status relationship-temperature
```

查看日志：

```bash
sudo journalctl -u relationship-temperature -f
```

## 9. Nginx 反向代理

### 9.1 无域名阶段

创建配置：

```bash
sudo nano /etc/nginx/sites-available/relationship-temperature
```

内容：

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

启用：

```bash
sudo ln -s /etc/nginx/sites-available/relationship-temperature /etc/nginx/sites-enabled/relationship-temperature
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

验收：

```bash
curl -I http://127.0.0.1
curl -I http://VPS_IP
```

### 9.2 域名阶段

域名解析到 VPS 后，把 `server_name` 改为：

```nginx
server_name example.com www.example.com;
```

然后申请 HTTPS：

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d example.com -d www.example.com
sudo certbot renew --dry-run
```

## 10. 每日刷新

### 10.1 缓存表模式

缓存表模式不建议在 VPS 上跑 `scheduled_refresh`，因为 VPS 没有完整 MapNews 导入批次和完整 GDELT 数据。

推荐流程：

```text
本地完整数据库或数据机器
  -> 每日运行 precompute --with-ai
  -> 同步 relationship_* 缓存表到 VPS 生产库
```

### 10.2 独立 GDELT 导入模式

推荐生产定时任务在服务器本地时间每天 08:00 开始导入。GDELT 前一天完整文件通常在北京时间 07:34 左右齐全，08:00 启动并允许最多等待 120 分钟，可以覆盖偶发延迟。

```cron
0 8 * * * cd /var/www/relationship-temperature && /var/www/relationship-temperature/.venv/bin/python -m relationship_temperature.gdelt_importer --wait-for-files --wait-timeout-minutes 120 --precompute --with-ai --prune-days 120 >> /var/log/relationship-temperature-refresh.log 2>&1
```

### 10.3 手工精简 GDELT 切片模式

如果每天会先把最新精简事件切片同步到 VPS，则在 VPS 上运行：

```bash
cd /var/www/relationship-temperature
.venv/bin/python -m relationship_temperature.precompute --with-ai
```

cron 示例：

```bash
crontab -e
```

```cron
0 8 * * * cd /var/www/relationship-temperature && /var/www/relationship-temperature/.venv/bin/python -m relationship_temperature.precompute --with-ai >> /var/log/relationship-temperature-refresh.log 2>&1
```

如果生产库也维护 `gdelt_import_batches`，并且需要等待 MapNews 导入完成，再改用：

```cron
0 8 * * * cd /var/www/relationship-temperature && /var/www/relationship-temperature/.venv/bin/python -m relationship_temperature.scheduled_refresh >> /var/log/relationship-temperature-refresh.log 2>&1
```

## 11. Git 更新流程

### 11.1 第一阶段：手动更新

```bash
ssh geoprizm-vps
cd /var/www/relationship-temperature

scripts/deploy_production.sh
```

该脚本会执行 `git fetch`、`git reset --hard origin/main`、`npm ci`、`npm run build`，并重启 `relationship-temperature.service`。

### 11.2 第二阶段：GitHub Actions 自动部署

后续可配置 GitHub Actions：

```text
push main
  -> GitHub Actions SSH 到 VPS
  -> scripts/deploy_production.sh
```

私有仓库需要：

- VPS 上配置 deploy key。
- GitHub Actions 配置 SSH 私钥 secret。
- 服务用户对 `/var/www/relationship-temperature` 有写权限。

## 12. 验收清单

### 12.1 本地发布前检查

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Python 检查：

```bash
.venv/bin/python -m pytest
.venv/bin/python -m mypy relationship_temperature tests
.venv/bin/python -m ruff check relationship_temperature tests
```

### 12.2 VPS 服务检查

```bash
sudo systemctl status relationship-temperature
sudo journalctl -u relationship-temperature --no-pager -n 80
sudo nginx -t
sudo systemctl status nginx
```

端口检查：

```bash
ss -tulpn | grep -E ':80|:443|:3000'
```

预期：

- `80` 和 `443` 由 Nginx 监听公网。
- `3000` 只监听 `127.0.0.1`。

接口检查：

```bash
curl -s http://127.0.0.1:3000/api/trend | head
curl -s http://VPS_IP/api/trend | head
```

域名接入后：

```bash
curl -I https://example.com
curl -s https://example.com/api/trend | head
```

### 12.3 用户体验检查

- `http://VPS_IP` 能打开页面。
- `/api/trend` 返回 `cacheStatus` 和 `relationship` 数据。
- 页面重点关系卡片有数据。
- 点击趋势段后 AI 解读接口能返回结果或明确的错误提示。
- 域名接入后 HTTPS 小锁正常。
- 重启 VPS 后服务自动恢复。

## 13. 风险和处理

| 风险 | 表现 | 处理 |
| --- | --- | --- |
| 1GB 内存不足 | `npm run build` 卡死或被杀 | 加 2GB swap，必要时升级 2C2G |
| 数据库过大 | 20-40GB SSD 不够 | 不迁完整 MapNews，只迁缓存或精简切片 |
| Cloudflare 橙云绕路 | 大陆访问变慢 | 默认灰云 DNS-only |
| 无域名无法 HTTPS | 只能 HTTP 访问 IP | 先用 IP 验收，买域名后配 Certbot |
| Python 路径错误 | AI 接口或刷新任务失败 | 设置 `PYTHON_BIN=/var/www/relationship-temperature/.venv/bin/python` |
| 私有仓库无法拉取 | `git pull` 失败 | 配置 deploy key |
| 生产库无 GDELT 批次表 | `scheduled_refresh` 等待失败 | 使用 `gdelt_importer --precompute`，不要用 MapNews 等待逻辑 |

## 14. 推荐执行顺序

1. 使用现有 DediOne VPS。
2. 初始化系统、swap、Node.js、Python、Nginx。
3. 拉取项目代码并安装依赖。
4. 先用独立 GDELT 导入模式准备生产数据库。
5. 构建 Next.js，并用 systemd 常驻。
6. 配置 Nginx，通过 `http://VPS_IP` 验收。
7. 买 `.com` 域名，Cloudflare 接管 DNS，灰云 A 记录指向 VPS。
8. 配置 Certbot HTTPS。
9. 建立每日 `gdelt_importer --precompute --with-ai` 刷新流程。
10. 稳定后再配置 GitHub Actions 自动部署。
