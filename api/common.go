package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

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
