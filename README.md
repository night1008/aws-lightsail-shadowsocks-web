本项目是 [aws-lightsail-shadowsocks-tf](https://github.com/night1008/aws-lightsail-shadowsocks-tf) 的可视化配置页面。

## 整体架构

                             ┌────────────────────┐
                             │                    │
                             │     Aliyun OSS     │
       ┌─────────────────────│                    │◀───────────────────┐
       │                     │                    │                    │
       │                     └────────────────────┘                    │
       │                                │                              │
       │                                │                              │
       │                                │                              │
       │                                │                              │
       ▼                                ▼                              │
┌─────────────┐                 ┌──────────────┐               ┌───────────────┐
│             │                 │              │               │               │
│   Vercel    │                 │    Github    │               │   Terraform   │
│  (Nextjs)   │────────────────▶│    Action    │──────────────▶│               │
│             │                 │              │               │               │
└─────────────┘                 └──────────────┘               └───────────────┘

## 开发

启动本地服务器:

```bash
npm run dev
# or
yarn dev
```

访问 [http://localhost:3000](http://localhost:3000)
