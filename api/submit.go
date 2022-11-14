package handler

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

func SubmitHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		fmt.Fprintf(w, "invalid http method")
		return
	}

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

	if err := bucket.PutObject(inputObjectKey, r.Body); err != nil {
		fmt.Fprintf(w, err.Error())
		return
	}

	githubAccessToken := os.Getenv("GITHUB_ACCESS_TOKEN")
	fmt.Println("githubAccessToken ", githubAccessToken)
	if err := sendGithubWorkflowDispatchRequest(githubAccessToken); err != nil {
		fmt.Fprintf(w, err.Error())
		return
	}

	fmt.Fprintf(w, `{"success": true}`)
}

func sendGithubWorkflowDispatchRequest(githubAccessToken string) error {
	repositoryURL := "https://api.github.com/repos/night1008/aws-lightsail-shadowsocks-tf/dispatches"

	jsonBody := []byte(`{"event_type": "deploy-instances"}`)
	bodyReader := bytes.NewReader(jsonBody)
	req, err := http.NewRequest(http.MethodPost, repositoryURL, bodyReader)
	if err != nil {
		return err
	}
	req.Header.Add("Accept", "application/vnd.github+json")
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", githubAccessToken))

	client := http.Client{
		Timeout: 30 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	if resp.StatusCode == http.StatusNoContent {
		return nil
	} else {
		return fmt.Errorf("github response status code %d", resp.StatusCode)
	}
}
