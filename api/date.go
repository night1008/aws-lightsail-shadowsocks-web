package handler

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	endpoint := os.Getenv("OSS_ENDPOINT")
	accessKeyID := os.Getenv("OSS_ACCESS_KEY_ID")
	accessKeySecret := os.Getenv("OSS_ACCESS_KEY_SECRET")
	bucketName := os.Getenv("OSS_BUCKET")

	client, err := oss.New(endpoint, accessKeyID, accessKeySecret)
	if err != nil {
		fmt.Fprintf(w, err.Error())
		return
	}

	bucket, err := client.Bucket(bucketName)
	if err != nil {
		fmt.Fprintf(w, err.Error())
		return
	}

	inputObjectKey := "inputs/terraform.tfvars.json"
	body, err := bucket.GetObject(inputObjectKey)
	if err != nil {
		fmt.Fprintf(w, err.Error())
		return
	}

	defer body.Close()
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, body); err != nil {
		fmt.Fprintf(w, err.Error())
		return
	}
	fmt.Fprintf(w, string(buf.Bytes()))
}
