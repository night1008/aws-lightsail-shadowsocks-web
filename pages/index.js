import Head from 'next/head'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Card from 'react-bootstrap/Card'
import Button from 'react-bootstrap/Button'
import CloseButton from 'react-bootstrap/CloseButton'
import FloatingLabel from 'react-bootstrap/FloatingLabel'
import Spinner from 'react-bootstrap/Spinner'
import styles from '../styles/Home.module.css'

const defaultInstanceConfig = {
  "region": "ap-northeast-1",
  "instance_name": "lightsail-JP",
  "availability_zone": "ap-northeast-1a",
  "create_static_ip": true,
  "shadowsocks_libev_port": 8388,
  "shadowsocks_libev_password_length": 10,
  "shadowsocks_libev_method": "chacha20-ietf-poly1305"
}

export default function Home() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [instanceConfigs, setInstanceConfigs] = useState([])
  const [submitTime, setSubmitTime] = useState(0)
  const [authToken, setAuthToken] = useState("")

  useEffect(() => {
    setLoading(true)
    fetch('/api/input')
      .then((res) => res.json())
      .then((data) => {
        setData(data)
        setInstanceConfigs(data.instances)
        setLoading(false)
        console.log(data)
      })
  }, [submitTime])

  function handleSubmitInstanceConfig(e) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    fetch('/api/submit', {
      method: "POST",
      body: JSON.stringify({
        "auth_token": authToken,
        "instances": instanceConfigs
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setEditMode(false)
        setSubmitTime(new Date().getTime())
      })
  }

  function handleAddInstanceConfig() {
    const configs = [...instanceConfigs]
    configs.push(Object.assign({}, defaultInstanceConfig))
    setInstanceConfigs(configs)
  }

  function handleRemoveInstanceConfig(index, e) {
    const configs = [...instanceConfigs]
    configs.splice(index, 1)
    setInstanceConfigs(configs)
  }

  function handleInstanceChange(index, attr, e) {
    const configs = [...instanceConfigs]
    if (e.currentTarget.type == "checkbox") {
      configs[index][attr] = e.currentTarget.checked
    } else if (e.currentTarget.type == "number") {
      configs[index][attr] = parseFloat(e.currentTarget.value)
    } else {
      configs[index][attr] = e.currentTarget.value
      if (attr == "region") {
        configs[index]["availability_zone"] = lightsail_availability_zones[e.currentTarget.value][0].value
      }
    }
    setInstanceConfigs(configs)
  }

  return (
    <div className="container">
      <Head>
        <title>Shadowsocks config</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h3 className="text-success text-center py-3">
          Shadowsocks input config
        </h3>

        {loading && !editMode &&
          <div className="text-center py-3">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>}

        {!loading &&
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" role="switch" id="flexSwitchCheckDefault" onClick={() => setEditMode(!editMode)} />
            <label className="form-check-label" htmlFor="flexSwitchCheckDefault">{editMode ? '关闭' : '开启'}编辑</label>
          </div>}
        <hr />

        {!loading && !editMode && (data?.instances || []).length > 0 && (
          <div className="row row-cols-1 row-cols-md-2 g-4">
            {(data?.instances || []).map((instance) => (
              <div className="col" key={instance.instance_name}>
                <div className="card">
                  <div className="card-header">
                    {instance.instance_name}
                  </div>
                  <div className="card-body">
                    <pre className="card-text">
                      {JSON.stringify(instance, null, 4)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !editMode && (data?.instances || []).length == 0 && (
          <div className="text-muted text-center pb-3">暂无实例</div>
        )}

        {!loading && editMode && (
          <Form onSubmit={handleSubmitInstanceConfig}>
            {instanceConfigs.map((instance, index) => (
              <Card className="mb-3" key={index}>
                <Card.Header>
                  <CloseButton style={{ "float": "right" }} onClick={(e) => handleRemoveInstanceConfig(index, e)} />
                  <Row className="row-cols-1 row-cols-md-2" >
                    <Form.Group style={{ paddingLeft: 0 }}>
                      <FloatingLabel label="instance name">
                        <Form.Control type="text" placeholder="instance name" value={instance.instance_name} onChange={(e) => handleInstanceChange(index, 'instance_name', e)} />
                      </FloatingLabel>
                    </Form.Group>
                  </Row>
                </Card.Header>
                <Card.Body>
                  <Row className="row-cols-1 row-cols-md-2">
                    <Col>
                      <Form.Group className="mb-3">
                        <Form.Label>region</Form.Label>
                        <Form.Select placeholder="instance name" value={instance.region} onChange={(e) => handleInstanceChange(index, 'region', e)}>
                          {lightsail_regions.map(option => (
                            <option value={option.value} key={option.value}>{option.label}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col>
                      <Form.Group className="mb-3">
                        <Form.Label>availability_zone</Form.Label>
                        <Form.Select onChange={(e) => handleInstanceChange(index, 'availability_zone', e)}>
                          {(lightsail_availability_zones[instance.region] || []).map(option => (
                            <option value={option.value} key={option.value}>{option.label}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row className="row-cols-1 row-cols-md-2">
                    <Col>
                      <Form.Group className="mb-3">
                        <Form.Label>shadowsocks_libev_method</Form.Label>
                        <Form.Select onChange={(e) => handleInstanceChange(index, 'shadowsocks_libev_method', e)}>
                          {shadowsocks_libev_method_options.map(option => (
                            <option value={option.value} key={option.value}>{option.label}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col>
                      <Form.Group className="mb-3">
                        <Form.Label>shadowsocks_libev_port</Form.Label>
                        <Form.Control type="number" placeholder="shadowsocks_libev_port" value={instance.shadowsocks_libev_port} onChange={(e) => handleInstanceChange(index, 'shadowsocks_libev_port', e)} />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row className="row-cols-1 row-cols-md-2">
                    <Col>
                      <Form.Group className="mb-3">
                        <Form.Label>shadowsocks_libev_password_length</Form.Label>
                        <Form.Control type="number" placeholder="shadowsocks_libev_password_length" value={instance.shadowsocks_libev_password_length} onChange={(e) => handleInstanceChange(index, 'shadowsocks_libev_password_length', e)} />
                      </Form.Group>
                    </Col>
                    <Col>
                      <Form.Group>
                        <Form.Label>create_static_ip</Form.Label>
                        <Form.Check
                          checked={instance.create_static_ip}
                          onChange={(e) => handleInstanceChange(index, 'create_static_ip', e)}
                          type="switch"
                          label="create_static_ip"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            ))}

            <Row className="mb-3">
              <Col>
                <Form.Group style={{ paddingLeft: 0 }}>
                  <Form.Control type="text" placeholder="auth token" value={authToken} onChange={(e) => setAuthToken(e.currentTarget.value)} />
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex justify-content-between">
              <Button variant="outline-success" className="mr-auto" onClick={handleAddInstanceConfig}>增加实例</Button>
              <Button variant="primary" disabled={loading} onClick={(e) => handleSubmitInstanceConfig(e)}>提交配置</Button>
              <Button style={{ padding: 0, border: 0 }}></Button>
            </div>
          </Form>
        )}
      </main>

      <footer className={styles.footer}>
        Powered by{' '}
        <span className={styles.logo}>
          <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
        </span>
      </footer>
    </div >
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
