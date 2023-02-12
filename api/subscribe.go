package handler

import (
	"crypto/md5"
	"encoding/hex"
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

type ShadowsockServer struct {
	ID         string                 `json:"id"`
	Remarks    string                 `json:"remarks"`
	Server     string                 `json:"server"`
	ServerPort int                    `json:"server_port"`
	Method     string                 `json:"method"`
	Password   string                 `json:"password"`
	Plugin     string                 `json:"plugin"`
	PluginOpts map[string]interface{} `json:"plugin_opts"`
	SSURL      string                 `json:"ss_url"`
}

type ShadowsocksOutput struct {
	Version int                 `json:"version"`
	Servers []*ShadowsockServer `json:"servers"`
}

// https://shadowsocks.org/guide/sip008.html
func shadowsocksConfigToOutput(cfg *ShadowsocksConfig) *ShadowsockServer {
	server := cfg.StaticIP
	if server == "" {
		server = cfg.PublicIPAddress
	}
	s := &ShadowsockServer{
		Remarks:    cfg.InstanceName,
		Server:     server,
		ServerPort: cfg.ShadowsocksConfig.ServerPort,
		Method:     cfg.ShadowsocksConfig.Method,
		Password:   cfg.ShadowsocksConfig.Password,
		SSURL:      cfg.SSURL,
	}
	s.ID = getShadowsockServerID(s)
	return s
}

func getShadowsockServerID(s *ShadowsockServer) string {
	h := md5.New()
	h.Write([]byte(s.Remarks))
	h.Write([]byte(s.Server))
	h.Write([]byte(fmt.Sprintf("%d", s.ServerPort)))
	h.Write([]byte(s.Password))
	h.Write([]byte(s.Method))
	return hex.EncodeToString(h.Sum(nil))
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

	output := ShadowsocksOutput{
		Version: 1,
	}
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
		output.Servers = append(output.Servers, shadowsocksConfigToOutput(&cfg))
	}

	response(w, http.StatusOK, output)
}
