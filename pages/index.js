import Head from 'next/head'
import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'

const defaultInstanceConfig = {
  "region": "ap-northeast-1",
  "instance_name": "instance-1",
  "availability_zone": "ap-northeast-1a",
  "create_static_ip": false,
  "shadowsocks_enable": true,
  "shadowsocks_libev_port": 8388,
  "shadowsocks_libev_password_length": 10,
  "shadowsocks_libev_method": "chacha20-ietf-poly1305",
  "hysteria_enable": true,
  "hysteria_password_length": 10,
  "hysteria_proxy_url": "https://bing.com",
  "xray_enable": false,
  "xray_port": 443,
  "xray_proxy_url": "https://www.google.com",
  "xray_private_key": "",
  "xray_public_key": ""
}

function normalizeInstanceConfig(instance) {
  const config = {
    ...defaultInstanceConfig,
    ...(instance || {})
  }

  // 确保 availability_zone 与 region 一致
  const regionZones = lightsail_availability_zones[config.region]
  if (regionZones && regionZones.length > 0) {
    const hasAvailabilityZone = regionZones.some((zone) => zone.value === config.availability_zone)
    if (!hasAvailabilityZone) {
      config.availability_zone = regionZones[0].value
    }
  } else if (!config.availability_zone && config.region) {
    // region 不在前端 zone map 中时，根据 region 生成默认 availability_zone
    config.availability_zone = config.region + "a"
  }

  return config
}

function validateInstanceConfig(instance, index) {
  const name = instance.instance_name || `#${index + 1}`
  if (!instance.shadowsocks_enable && !instance.hysteria_enable && !instance.xray_enable) {
    return `实例 ${name} 至少开启一个协议`
  }

  if (!instance.region) {
    return `实例 ${name} region 不能为空`
  }

  if (!instance.availability_zone) {
    return `实例 ${name} availability_zone 不能为空`
  }

  // hysteria_proxy_url 格式校验
  if (instance.hysteria_enable) {
    if (!/^https?:\/\//.test(instance.hysteria_proxy_url)) {
      return `实例 ${name} hysteria_proxy_url 必须是有效的 http(s) URL`
    }
  }

  // xray 启用时需要校验 proxy_url、private_key、public_key
  if (instance.xray_enable) {
    if (!/^https?:\/\//.test(instance.xray_proxy_url)) {
      return `实例 ${name} xray_proxy_url 必须是有效的 http(s) URL`
    }
    if (!instance.xray_private_key || !instance.xray_public_key) {
      return `实例 ${name} 启用 xray 时必须提供 xray_private_key 和 xray_public_key`
    }
  }

  // 端口冲突检查
  // hysteria2 固定使用 443
  const HYSTERIA_PORT = 443

  if (instance.hysteria_enable) {
    if (instance.shadowsocks_enable && instance.shadowsocks_libev_port === HYSTERIA_PORT) {
      return `实例 ${name} 端口冲突: hysteria2 固定使用 443，shadowsocks_libev_port 不能使用 443`
    }
    if (instance.xray_enable && instance.xray_port === HYSTERIA_PORT) {
      return `实例 ${name} 端口冲突: hysteria2 固定使用 443，xray_port 不能使用 443`
    }
  }

  if (instance.shadowsocks_enable && instance.xray_enable) {
    if (instance.shadowsocks_libev_port === instance.xray_port) {
      return `实例 ${name} 端口冲突: shadowsocks_libev_port (${instance.shadowsocks_libev_port}) 与 xray_port 不能相同`
    }
  }

  return null
}

export default function Home() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [instanceConfigs, setInstanceConfigs] = useState([])
  const [submitTime, setSubmitTime] = useState(0)
  const [authToken, setAuthToken] = useState("")
  const [formError, setFormError] = useState("")

  useEffect(() => {
    setLoading(true)
    fetch('/api/input')
      .then((res) => res.json())
      .then((data) => {
        const normalizedInstances = (data.combined_instances || []).map((instance) => normalizeInstanceConfig(instance))
        setData({
          ...data,
          combined_instances: normalizedInstances
        })
        setInstanceConfigs(normalizedInstances)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        setFormError('加载配置失败')
      })
  }, [submitTime])

  function handleSubmitInstanceConfig(e) {
    e.preventDefault()
    e.stopPropagation()

    for (let i = 0; i < instanceConfigs.length; i++) {
      const err = validateInstanceConfig(instanceConfigs[i], i)
      if (err) {
        setFormError(err)
        return
      }
    }

    setFormError("")
    setLoading(true)
    fetch('/api/submit', {
      method: "POST",
      body: JSON.stringify({
        "auth_token": authToken,
        "combined_instances": instanceConfigs
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setLoading(false)
          setFormError(data.error)
          return
        }
        setEditMode(false)
        setFormError("")
        setSubmitTime(new Date().getTime())
      })
      .catch(() => {
        setLoading(false)
        setFormError('提交失败')
      })
  }

  function handleAddInstanceConfig() {
    const configs = [...instanceConfigs]
    configs.push(Object.assign({}, defaultInstanceConfig, {
      instance_name: `instance-${configs.length + 1}`
    }))
    setInstanceConfigs(configs)
  }

  function handleRemoveInstanceConfig(index) {
    const configs = [...instanceConfigs]
    configs.splice(index, 1)
    setInstanceConfigs(configs)
  }

  function handleInstanceChange(index, attr, value) {
    const configs = [...instanceConfigs]
    configs[index][attr] = value
    if (attr === "region") {
      const zones = lightsail_availability_zones[value]
      if (zones && zones.length > 0) {
        configs[index]["availability_zone"] = zones[0].value
      } else {
        // region 不在前端 zone map 中时，根据 region 生成默认 availability_zone
        configs[index]["availability_zone"] = value + "a"
      }
    }
    setFormError("")
    setInstanceConfigs(configs)
  }

  function getRegionLabel(regionCode) {
    const region = lightsail_regions.find(r => r.value === regionCode)
    return region ? region.label : regionCode
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Head>
        <title>Shadowsocks config</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="font-semibold text-sm">Shadowsocks Config</span>
          </div>
          {!loading && (
            <div className="flex items-center gap-2">
              <Label htmlFor="edit-mode" className="text-sm text-muted-foreground cursor-pointer">
                {editMode ? '关闭编辑' : '开启编辑'}
              </Label>
              <Switch
                id="edit-mode"
                checked={editMode}
                onCheckedChange={(checked) => setEditMode(checked)}
              />
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-8">
        {loading && !editMode && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* 查看模式 */}
        {!loading && !editMode && (data?.combined_instances || []).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.combined_instances || []).map((instance) => (
              <Card key={instance.instance_name} className="overflow-hidden">
                <CardHeader className="bg-muted/40 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="font-medium text-sm">{instance.instance_name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{getRegionLabel(instance.region)}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div className="text-muted-foreground">Region</div>
                    <div>{getRegionLabel(instance.region)}</div>
                    <div className="text-muted-foreground">可用区</div>
                    <div>{instance.availability_zone}</div>
                    <div className="text-muted-foreground">静态 IP</div>
                    <div>{instance.create_static_ip ? <span className="text-green-600 font-medium">✓ 启用</span> : <span className="text-muted-foreground">—</span>}</div>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${instance.shadowsocks_enable ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                      <span className="font-semibold text-sm">Shadowsocks</span>
                      {instance.shadowsocks_enable ? <span className="text-xs text-green-600">已启用</span> : <span className="text-xs text-muted-foreground">未启用</span>}
                    </div>
                    {instance.shadowsocks_enable && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm ml-4">
                        <div className="text-muted-foreground">端口</div>
                        <div>{instance.shadowsocks_libev_port}</div>
                        <div className="text-muted-foreground">加密方法</div>
                        <div><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{instance.shadowsocks_libev_method}</code></div>
                        <div className="text-muted-foreground">密码长度</div>
                        <div>{instance.shadowsocks_libev_password_length}</div>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${instance.hysteria_enable ? 'bg-blue-500' : 'bg-muted-foreground/30'}`} />
                      <span className="font-semibold text-sm">Hysteria2</span>
                      {instance.hysteria_enable ? <span className="text-xs text-blue-600">已启用</span> : <span className="text-xs text-muted-foreground">未启用</span>}
                    </div>
                    {instance.hysteria_enable && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm ml-4">
                        <div className="text-muted-foreground">密码长度</div>
                        <div>{instance.hysteria_password_length}</div>
                        <div className="text-muted-foreground">伪装 URL</div>
                        <div className="truncate" title={instance.hysteria_proxy_url}><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{instance.hysteria_proxy_url}</code></div>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${instance.xray_enable ? 'bg-purple-500' : 'bg-muted-foreground/30'}`} />
                      <span className="font-semibold text-sm">Xray</span>
                      {instance.xray_enable ? <span className="text-xs text-purple-600">已启用</span> : <span className="text-xs text-muted-foreground">未启用</span>}
                    </div>
                    {instance.xray_enable && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm ml-4">
                        <div className="text-muted-foreground">端口</div>
                        <div>{instance.xray_port}</div>
                        <div className="text-muted-foreground">伪装 URL</div>
                        <div className="truncate" title={instance.xray_proxy_url}><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{instance.xray_proxy_url}</code></div>
                        <div className="text-muted-foreground">Private Key</div>
                        <div className="truncate font-mono text-xs" title={instance.xray_private_key}>{instance.xray_private_key || <span className="text-muted-foreground">—</span>}</div>
                        <div className="text-muted-foreground">Public Key</div>
                        <div className="truncate font-mono text-xs" title={instance.xray_public_key}>{instance.xray_public_key || <span className="text-muted-foreground">—</span>}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && !editMode && (data?.combined_instances || []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <div className="text-4xl">🌐</div>
            <p className="text-sm">暂无实例，开启编辑后添加</p>
          </div>
        )}

        {/* 编辑模式 */}
        {!loading && editMode && (
          <form onSubmit={handleSubmitInstanceConfig}>
            {formError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            {instanceConfigs.map((instance, index) => (
              <Card className="mb-5 shadow-sm" key={index}>
                <CardHeader className="bg-muted/30 border-b">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">#{index + 1}</span>
                    <div className="flex-1 max-w-xs">
                      <Input
                        type="text"
                        placeholder="instance name"
                        value={instance.instance_name}
                        onChange={(e) => handleInstanceChange(index, 'instance_name', e.target.value)}
                        className="h-8 font-medium"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveInstanceConfig(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 基础配置 */}
                  <Card className="bg-muted/20">
                    <CardHeader className="border-b">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">基础配置</span>
                    </CardHeader>
                    <CardContent className="py-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                        <div className="space-y-1">
                          <Label>region</Label>
                          <Select
                            value={instance.region}
                            onValueChange={(value) => handleInstanceChange(index, 'region', value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {lightsail_regions.map(option => (
                                <SelectItem value={option.value} key={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>availability_zone</Label>
                          <Select
                            key={`az-${index}-${instance.region}`}
                            value={instance.availability_zone}
                            onValueChange={(value) => handleInstanceChange(index, 'availability_zone', value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(lightsail_availability_zones[instance.region] || []).map(option => (
                                <SelectItem value={option.value} key={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>create_static_ip</Label>
                          <div className="flex items-center h-9">
                            <Switch
                              checked={instance.create_static_ip}
                              onCheckedChange={(checked) => handleInstanceChange(index, 'create_static_ip', checked)}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 协议配置 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Shadowsocks */}
                    <Card className={`flex flex-col transition-opacity ${!instance.shadowsocks_enable ? 'opacity-60' : ''}`}>
                      <CardHeader className="border-b bg-muted/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${instance.shadowsocks_enable ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                            <span className="font-semibold text-sm">Shadowsocks</span>
                          </div>
                          <Switch
                            checked={instance.shadowsocks_enable}
                            onCheckedChange={(checked) => handleInstanceChange(index, 'shadowsocks_enable', checked)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">shadowsocks_libev_method</Label>
                          <Select
                            value={instance.shadowsocks_libev_method}
                            onValueChange={(value) => handleInstanceChange(index, 'shadowsocks_libev_method', value)}
                            disabled={!instance.shadowsocks_enable}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {shadowsocks_libev_method_options.map(option => (
                                <SelectItem value={option.value} key={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">shadowsocks_libev_port</Label>
                          <Input
                            type="number"
                            value={instance.shadowsocks_libev_port}
                            onChange={(e) => handleInstanceChange(index, 'shadowsocks_libev_port', parseInt(e.target.value) || 0)}
                            disabled={!instance.shadowsocks_enable}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">shadowsocks_libev_password_length</Label>
                          <Input
                            type="number"
                            value={instance.shadowsocks_libev_password_length}
                            onChange={(e) => handleInstanceChange(index, 'shadowsocks_libev_password_length', parseInt(e.target.value) || 0)}
                            disabled={!instance.shadowsocks_enable}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Hysteria */}
                    <Card className={`flex flex-col transition-opacity ${!instance.hysteria_enable ? 'opacity-60' : ''}`}>
                      <CardHeader className="border-b bg-muted/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${instance.hysteria_enable ? 'bg-blue-500' : 'bg-muted-foreground'}`} />
                            <span className="font-semibold text-sm">Hysteria</span>
                          </div>
                          <Switch
                            checked={instance.hysteria_enable}
                            onCheckedChange={(checked) => handleInstanceChange(index, 'hysteria_enable', checked)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">hysteria_password_length</Label>
                          <Input
                            type="number"
                            value={instance.hysteria_password_length}
                            onChange={(e) => handleInstanceChange(index, 'hysteria_password_length', parseInt(e.target.value) || 0)}
                            disabled={!instance.hysteria_enable}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">hysteria_proxy_url</Label>
                          <Input
                            type="text"
                            value={instance.hysteria_proxy_url}
                            onChange={(e) => handleInstanceChange(index, 'hysteria_proxy_url', e.target.value)}
                            disabled={!instance.hysteria_enable}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Xray */}
                    <Card className={`flex flex-col transition-opacity ${!instance.xray_enable ? 'opacity-60' : ''}`}>
                      <CardHeader className="border-b bg-muted/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${instance.xray_enable ? 'bg-purple-500' : 'bg-muted-foreground'}`} />
                            <span className="font-semibold text-sm">Xray</span>
                          </div>
                          <Switch
                            checked={instance.xray_enable}
                            onCheckedChange={(checked) => handleInstanceChange(index, 'xray_enable', checked)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">xray_port</Label>
                          <Input
                            type="number"
                            value={instance.xray_port}
                            onChange={(e) => handleInstanceChange(index, 'xray_port', parseInt(e.target.value) || 0)}
                            disabled={!instance.xray_enable}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">xray_proxy_url</Label>
                          <Input
                            type="text"
                            value={instance.xray_proxy_url}
                            onChange={(e) => handleInstanceChange(index, 'xray_proxy_url', e.target.value)}
                            disabled={!instance.xray_enable}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">xray_private_key</Label>
                          <Input
                            type="text"
                            value={instance.xray_private_key}
                            onChange={(e) => handleInstanceChange(index, 'xray_private_key', e.target.value)}
                            disabled={!instance.xray_enable}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">xray_public_key</Label>
                          <Input
                            type="text"
                            value={instance.xray_public_key}
                            onChange={(e) => handleInstanceChange(index, 'xray_public_key', e.target.value)}
                            disabled={!instance.xray_enable}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="border rounded-xl p-4 bg-background flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Input
                type="password"
                placeholder="Auth Token"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                className="flex-1"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleAddInstanceConfig} className="flex-1 sm:flex-none">
                  + 增加实例
                </Button>
                <Button type="submit" disabled={loading} className="flex-1 sm:flex-none">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  提交配置
                </Button>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}

const shadowsocks_libev_method_options = [
  {
    "value": "chacha20-ietf-poly1305",
    "label": "chacha20-ietf-poly1305"
  },
  {
    "value": "aes-256-gcm",
    "label": "aes-256-gcm"
  }
]

const lightsail_regions = [
  {
    "value": "us-east-2",
    "label": "US East (Ohio)"
  },
  {
    "value": "us-west-2",
    "label": "US West (Oregon)"
  },
  {
    "value": "ap-south-1",
    "label": "Asia Pacific (Mumbai)"
  },
  {
    "value": "ap-northeast-2",
    "label": "Asia Pacific (Seoul)"
  },
  {
    "value": "ap-southeast-1",
    "label": "Asia Pacific (Singapore)"
  },
  {
    "value": "ap-southeast-2",
    "label": "Asia Pacific (Sydney)"
  },
  {
    "value": "ap-northeast-1",
    "label": "Asia Pacific (Tokyo)"
  },
  {
    "value": "ca-central-1",
    "label": "Canada (Central)"
  },
  {
    "value": "eu-central-1",
    "label": "EU (Frankfurt)"
  },
  {
    "value": "eu-west-1",
    "label": "EU (Ireland)"
  },
  {
    "value": "eu-west-2",
    "label": "EU (London)"
  },
  {
    "value": "eu-west-3",
    "label": "EU (Paris)"
  },
  {
    "value": "eu-north-1",
    "label": "EU (Stockholm)"
  }
]

const lightsail_availability_zones = {
  "us-east-2": [
    {
      "value": "us-east-2a",
      "label": "us-east-2a"
    },
    {
      "value": "us-east-2b",
      "label": "us-east-2b"
    },
    {
      "value": "us-east-2c",
      "label": "us-east-2c"
    }
  ],
  "us-west-2": [
    {
      "value": "us-west-2a",
      "label": "us-west-2a"
    },
    {
      "value": "us-west-2b",
      "label": "us-west-2b"
    },
    {
      "value": "us-west-2c",
      "label": "us-west-2c"
    },
    {
      "value": "us-west-2d",
      "label": "us-west-2d"
    }
  ],
  "ap-south-1": [
    {
      "value": "ap-south-1a",
      "label": "ap-south-1a"
    },
    {
      "value": "ap-south-1b",
      "label": "ap-south-1b"
    },
    {
      "value": "ap-south-1c",
      "label": "ap-south-1c"
    }
  ],
  "ap-northeast-2": [
    {
      "value": "ap-northeast-2a",
      "label": "ap-northeast-2a"
    },
    {
      "value": "ap-northeast-2b",
      "label": "ap-northeast-2b"
    },
    {
      "value": "ap-northeast-2c",
      "label": "ap-northeast-2c"
    },
    {
      "value": "ap-northeast-2d",
      "label": "ap-northeast-2d"
    }
  ],
  "ap-southeast-1": [
    {
      "value": "ap-southeast-1a",
      "label": "ap-southeast-1a"
    },
    {
      "value": "ap-southeast-1b",
      "label": "ap-southeast-1b"
    },
    {
      "value": "ap-southeast-1c",
      "label": "ap-southeast-1c"
    }
  ],
  "ap-southeast-2": [
    {
      "value": "ap-southeast-2a",
      "label": "ap-southeast-2a"
    },
    {
      "value": "ap-southeast-2b",
      "label": "ap-southeast-2b"
    },
    {
      "value": "ap-southeast-2c",
      "label": "ap-southeast-2c"
    }
  ],
  "ap-northeast-1": [
    {
      "value": "ap-northeast-1a",
      "label": "ap-northeast-1a"
    },
    {
      "value": "ap-northeast-1b",
      "label": "ap-northeast-1b"
    },
    {
      "value": "ap-northeast-1c",
      "label": "ap-northeast-1c"
    },
    {
      "value": "ap-northeast-1d",
      "label": "ap-northeast-1d"
    },
  ],
  "ca-central-1": [
    {
      "value": "ca-central-1a",
      "label": "ca-central-1a"
    },
    {
      "value": "ca-central-1b",
      "label": "ca-central-1b"
    },
    {
      "value": "ca-central-1c",
      "label": "ca-central-1c"
    },
    {
      "value": "ca-central-1d",
      "label": "ca-central-1d"
    }
  ],
  "eu-central-1": [
    {
      "value": "eu-central-1a",
      "label": "eu-central-1a"
    },
    {
      "value": "eu-central-1b",
      "label": "eu-central-1b"
    },
    {
      "value": "eu-central-1c",
      "label": "eu-central-1c"
    },
  ],
  "eu-west-1": [
    {
      "value": "eu-west-1a",
      "label": "eu-west-1a"
    },
    {
      "value": "eu-west-1b",
      "label": "eu-west-1b"
    },
    {
      "value": "eu-west-1c",
      "label": "eu-west-1c"
    }
  ],
  "eu-west-2": [
    {
      "value": "eu-west-2a",
      "label": "eu-west-2a"
    },
    {
      "value": "eu-west-2b",
      "label": "eu-west-2b"
    },
    {
      "value": "eu-west-2c",
      "label": "eu-west-2c"
    }
  ],
  "eu-west-3": [
    {
      "value": "eu-west-3a",
      "label": "eu-west-3a"
    },
    {
      "value": "eu-west-3b",
      "label": "eu-west-3b"
    },
    {
      "value": "eu-west-3c",
      "label": "eu-west-3c"
    },
  ],
  "eu-north-1": [
    {
      "value": "eu-north-1a",
      "label": "eu-north-1a"
    },
    {
      "value": "eu-north-1b",
      "label": "eu-north-1b"
    },
    {
      "value": "eu-north-1c",
      "label": "eu-north-1c"
    }
  ]
}
