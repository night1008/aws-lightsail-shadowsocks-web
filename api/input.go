package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

const (
	contentTypeKey   = "Content-Type"
	contentTypeValue = "application/json; charset=utf-8"
)

type H map[string]interface{}

func response(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set(contentTypeKey, contentTypeValue)

	dataBytes, err := json.Marshal(data)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(err.Error()))
	} else {
		w.WriteHeader(statusCode)
		w.Write(dataBytes)
	}
}

func getOSSClient(region, accessKey, accessKeySecret string) (*oss.Client, error) {
	endpoint := fmt.Sprintf("oss-%s.aliyuncs.com", region)
	return oss.New(endpoint, accessKey, accessKeySecret)
}

const (
	inputObjectKey = "inputs/terraform.tfvars.json"
)

var ossObjectNotExistPattern = regexp.MustCompile("(StatusCode=404|ErrorCode=NoSuchKey)")

type InstanceConfig struct {
	Region                         string `json:"region"`
	InstanceName                   string `json:"instance_name"`
	AvailabilityZone               string `json:"availability_zone"`
	CreateStaticIP                 bool   `json:"create_static_ip"`
	ShadowsocksLibevPort           int    `json:"shadowsocks_libev_port"`
	ShadowsocksLibevPasswordLength int    `json:"shadowsocks_libev_password_length"`
	ShadowsocksLibevMethod         string `json:"shadowsocks_libev_method"`
}

func InputHandler(w http.ResponseWriter, r *http.Request) {
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

	var instances []*InstanceConfig
	object, err := bucket.GetObject(inputObjectKey)
	if err != nil {
		// 处理最开始 key 不存在的情况
		if ossObjectNotExistPattern.MatchString(err.Error()) {
			response(w, http.StatusOK, H{"instances": instances})
		} else {
			response(w, http.StatusInternalServerError, H{"error": err.Error()})
		}
		return
	}

	defer object.Close()
	body, err := io.ReadAll(object)
	if err != nil {
		response(w, http.StatusInternalServerError, H{"error": err.Error()})
		return
	}
	if err := json.Unmarshal(body, &instances); err != nil {
		response(w, http.StatusInternalServerError, H{"error": err.Error()})
		return
	}

	response(w, http.StatusOK, H{"instances": instances})
}
