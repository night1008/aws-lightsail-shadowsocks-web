package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

const (
	outputObjectKeyPrefix = "outputs"
)

type ShadowsocksConfig struct {
	InstanceName      string `json:"instance_name"`
	PublicIPAddress   string `json:"public_ip_address"`
	ShadowsocksConfig struct {
		LocalPort  int      `json:"local_port"`
		Method     string   `json:"method"`
		Mode       string   `json:"mode"`
		Password   string   `json:"password"`
		Server     []string `json:"server"`
		ServerPort int      `json:"server_port"`
		Timeout    int      `json:"timeout"`
	} `json:"shadowsocks_config"`
	StaticIP string `json:"static_ip"`
	SSURL    string `json:"ss_url"`
}

type ShadowsocksOutput struct {
	Remarks    string                 `json:"remarks"`
	Type       string                 `json:"type"`
	Server     string                 `json:"server"`
	ServerPort int                    `json:"server_port"`
	Method     string                 `json:"method"`
	Password   string                 `json:"password"`
	Plugin     string                 `json:"plugin"`
	PluginOpts map[string]interface{} `json:"plugin_opts"`
	SSURL      string                 `json:"ss_url"`
}

//	{
//		"server": "134.195.196.230",
//		"server_port": 9102,
//		"password": "e4FCWrgpkji3QY",
//		"method": "aes-256-gcm",
//		"plugin": "",
//		"plugin_opts": null,
//		"remarks": "🇨🇦 Toronto, ON, Canada"
//	}
func shadowsocksConfigToOutput(cfg *ShadowsocksConfig) *ShadowsocksOutput {
	server := cfg.StaticIP
	if server == "" {
		server = cfg.PublicIPAddress
	}
	return &ShadowsocksOutput{
		Remarks:    cfg.InstanceName,
		Type:       "ss",
		Server:     server,
		ServerPort: cfg.ShadowsocksConfig.ServerPort,
		Method:     cfg.ShadowsocksConfig.Method,
		Password:   cfg.ShadowsocksConfig.Password,
		SSURL:      cfg.SSURL,
	}
}

func SubscribeHandler(w http.ResponseWriter, r *http.Request) {
	authToken := os.Getenv("AUTH_TOKEN")
	values := r.URL.Query()
	inputAuthToken := values.Get("auth_token")
	if inputAuthToken != authToken {
		fmt.Fprintf(w, fmt.Sprintf("invalid auth token"))
		return
	}

	region := os.Getenv("ALICLOUD_REGION")
	accessKey := os.Getenv("ALICLOUD_ACCESS_KEY")
	accessKeySecret := os.Getenv("ALICLOUD_SECRET_KEY")
	bucketName := os.Getenv("ALICLOUD_BUCKET")

	client, err := getOSSClient(region, accessKey, accessKeySecret)
	if err != nil {
		response(w, http.StatusInternalServerError, H{"error": err.Error()})
		return
	}

	bucket, err := client.Bucket(bucketName)
	if err != nil {
		response(w, http.StatusInternalServerError, H{"error": err.Error()})
		return
	}

	listObjects, err := bucket.ListObjects(oss.Prefix(outputObjectKeyPrefix))
	if err != nil {
		response(w, http.StatusInternalServerError, H{"error": err.Error()})
		return
	}

	var outputs []*ShadowsocksOutput
	for _, o := range listObjects.Objects {
		object, err := bucket.GetObject(o.Key)
		if err != nil {
			response(w, http.StatusInternalServerError, H{"error": err.Error()})
			return
		}
		defer object.Close()
		body, err := io.ReadAll(object)
		if err != nil {
			response(w, http.StatusInternalServerError, H{"error": err.Error()})
			return
		}

		var cfg ShadowsocksConfig
		if err := json.Unmarshal(body, &cfg); err != nil {
			response(w, http.StatusInternalServerError, H{"error": err.Error()})
			return
		}
		outputs = append(outputs, shadowsocksConfigToOutput(&cfg))
	}

	response(w, http.StatusOK, outputs)
}
