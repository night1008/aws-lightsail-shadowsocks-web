package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

const (
	outputObjectKeyPrefix = "outputs"
)

type ShadowsocksOutput struct {
	SSURL string `json:"ss_url"`
}

func OutputHandler(w http.ResponseWriter, r *http.Request) {
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

	var ssURLs []string
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

		var output ShadowsocksOutput
		if err := json.Unmarshal(body, &output); err != nil {
			response(w, http.StatusInternalServerError, H{"error": err.Error()})
			return
		}
		ssURLs = append(ssURLs, output.SSURL)
	}

	response(w, http.StatusOK, strings.Join(ssURLs, "\n"))
}
