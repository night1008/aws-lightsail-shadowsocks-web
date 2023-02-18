package handler

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

func SubmitHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		fmt.Fprintf(w, "invalid http method")
		return
	}

	if err := r.ParseForm(); err != nil {
		response(w, http.StatusInternalServerError, H{"error": err.Error()})
		return
	}
	authToken := os.Getenv("AUTH_TOKEN")
	inputAuthToken := r.FormValue("auth_token")
	if inputAuthToken != authToken {
		response(w, http.StatusInternalServerError, H{"error": "invalid auth token"})
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

	instances := r.FormValue("instances")
	instancesReader := strings.NewReader(instances)
	if err := bucket.PutObject(inputObjectKey, instancesReader); err != nil {
		response(w, http.StatusInternalServerError, H{"error": err.Error()})
		return
	}

	githubAccessToken := os.Getenv("GITHUB_ACCESS_TOKEN")
	githubRepository := os.Getenv("GITHUB_REPOSITORY")
	if err := sendGithubWorkflowDispatchRequest(githubAccessToken, githubRepository); err != nil {
		response(w, http.StatusInternalServerError, H{"error": err.Error()})
		return
	}

	response(w, http.StatusOK, H{"success": true})
}

func sendGithubWorkflowDispatchRequest(accessToken, repository string) error {
	repositoryURL := fmt.Sprintf("https://api.github.com/repos/%s/dispatches", repository)

	jsonBody := []byte(`{"event_type": "deploy-instances"}`)
	bodyReader := bytes.NewReader(jsonBody)
	req, err := http.NewRequest(http.MethodPost, repositoryURL, bodyReader)
	if err != nil {
		return err
	}
	req.Header.Add("Accept", "application/vnd.github+json")
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", accessToken))

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
