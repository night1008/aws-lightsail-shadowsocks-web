package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"regexp"
)

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
