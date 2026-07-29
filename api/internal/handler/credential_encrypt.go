package handler

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// Credential values must never travel to cb-tumblebug in the clear, and they must
// never reach the proxy's request dump either. cb-tumblebug takes them under a
// hybrid scheme: every value is sealed with a one-off AES-256 key, and that key is
// sealed with an RSA public key the server hands out together with a single-use
// token id.
//
// The browser sends plain values to this API and the encryption happens here, for
// two reasons: the public key token is short lived and single use, so fetching it
// and spending it belong in one server-side step; and keeping the crypto in Go
// means the same code path as cm-mayfly's `setup credential`, which is the
// implementation this follows.

const (
	credentialSubsystem    = "cb-tumblebug"
	credentialOperationId  = "RegisterCredential"
	credentialPublicKeyURL = "/credential/publicKey"
)

// keyValue is one credential field. Values are plain on the way in and sealed on
// the way out; the field names are whatever the CSP metainfo said they must be.
type keyValue struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// plainCredentialRequest is what the front-end posts.
type plainCredentialRequest struct {
	ProviderName           string     `json:"providerName"`
	CredentialHolder       string     `json:"credentialHolder"`
	CredentialKeyValueList []keyValue `json:"credentialKeyValueList"`
}

// sealedCredentialRequest matches cb-tumblebug's CredentialReq.
type sealedCredentialRequest struct {
	ProviderName                     string     `json:"providerName"`
	CredentialHolder                 string     `json:"credentialHolder"`
	PublicKeyTokenId                 string     `json:"publicKeyTokenId"`
	EncryptedClientAesKeyByPublicKey string     `json:"encryptedClientAesKeyByPublicKey"`
	CredentialKeyValueList           []keyValue `json:"credentialKeyValueList"`
}

type publicKeyResponse struct {
	PublicKey        string `json:"publicKey"`
	PublicKeyTokenId string `json:"publicKeyTokenId"`
}

// isCredentialRegistration reports whether this call carries credential values.
func isCredentialRegistration(subsystemName, operationId string) bool {
	return strings.EqualFold(subsystemName, credentialSubsystem) &&
		strings.EqualFold(operationId, credentialOperationId)
}

// sealCredentialRequest replaces the plain request body with the sealed form.
// A failure here must abort the call: forwarding the plain body would register
// credentials the server cannot read and would leak them into the request log.
func sealCredentialRequest(service Service, auth string, commonRequest *CommonRequest) error {
	plain, err := decodeCredentialRequest(commonRequest.Request)
	if err != nil {
		return err
	}

	if plain.ProviderName == "" {
		return fmt.Errorf("providerName is required")
	}
	if plain.CredentialHolder == "" {
		return fmt.Errorf("credentialHolder is required")
	}
	if len(plain.CredentialKeyValueList) == 0 {
		return fmt.Errorf("credentialKeyValueList is empty")
	}
	// An empty value is rejected here rather than at the server. cb-tumblebug's
	// initializer drops a provider whose credential has any blank field, and it
	// does so silently - the registration still reports success. Catching it now
	// is the difference between an error the user can act on and a credential
	// that looks registered but is not.
	for _, kv := range plain.CredentialKeyValueList {
		if strings.TrimSpace(kv.Key) == "" {
			return fmt.Errorf("credential field name is empty")
		}
		if kv.Value == "" {
			return fmt.Errorf("credential field %q has no value", kv.Key)
		}
	}

	pk, err := fetchCredentialPublicKey(service, auth)
	if err != nil {
		return err
	}

	rsaPublicKey, err := parseRSAPublicKey(pk.PublicKey)
	if err != nil {
		return err
	}

	aesKey := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, aesKey); err != nil {
		return fmt.Errorf("failed to generate AES key: %w", err)
	}

	sealedList := make([]keyValue, 0, len(plain.CredentialKeyValueList))
	for _, kv := range plain.CredentialKeyValueList {
		ciphertext, err := aesCBCEncrypt(aesKey, []byte(kv.Value))
		if err != nil {
			return fmt.Errorf("failed to encrypt credential field %q: %w", kv.Key, err)
		}
		sealedList = append(sealedList, keyValue{
			Key:   kv.Key,
			Value: base64.StdEncoding.EncodeToString(ciphertext),
		})
	}

	sealedAesKey, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, rsaPublicKey, aesKey, nil)
	if err != nil {
		return fmt.Errorf("failed to encrypt AES key: %w", err)
	}

	commonRequest.Request = sealedCredentialRequest{
		ProviderName:                     plain.ProviderName,
		CredentialHolder:                 plain.CredentialHolder,
		PublicKeyTokenId:                 pk.PublicKeyTokenId,
		EncryptedClientAesKeyByPublicKey: base64.StdEncoding.EncodeToString(sealedAesKey),
		CredentialKeyValueList:           sealedList,
	}
	return nil
}

// decodeCredentialRequest re-reads the already decoded body. The proxy hands the
// request over as interface{}, so a round trip through JSON is the way to reach
// the fields without changing the shared request type.
func decodeCredentialRequest(request interface{}) (*plainCredentialRequest, error) {
	if request == nil {
		return nil, fmt.Errorf("credential request body is missing")
	}
	raw, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to read credential request: %w", err)
	}
	plain := &plainCredentialRequest{}
	if err := json.Unmarshal(raw, plain); err != nil {
		return nil, fmt.Errorf("failed to read credential request: %w", err)
	}
	return plain, nil
}

func fetchCredentialPublicKey(service Service, auth string) (*publicKeyResponse, error) {
	req, err := http.NewRequest(http.MethodGet, service.BaseURL+credentialPublicKeyURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build public key request: %w", err)
	}
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}

	client := &http.Client{
		Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch public key: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read public key response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("public key request failed: %s", strings.TrimSpace(string(body)))
	}

	pk := &publicKeyResponse{}
	if err := json.Unmarshal(body, pk); err != nil {
		return nil, fmt.Errorf("failed to parse public key response: %w", err)
	}
	if pk.PublicKey == "" || pk.PublicKeyTokenId == "" {
		return nil, fmt.Errorf("public key response is incomplete")
	}
	return pk, nil
}

// parseRSAPublicKey accepts the PKCS#1 form cb-tumblebug emits today and falls
// back to PKIX so a server-side format change does not break registration.
func parseRSAPublicKey(publicKeyPem string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(publicKeyPem))
	if block == nil {
		return nil, fmt.Errorf("failed to decode public key PEM block")
	}

	if key, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
		return key, nil
	}

	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse public key: %w", err)
	}
	key, ok := parsed.(*rsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("public key is not an RSA key")
	}
	return key, nil
}

// aesCBCEncrypt returns IV || ciphertext, which is the layout cb-tumblebug
// expects: it takes the first block as the IV.
func aesCBCEncrypt(key, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	iv := make([]byte, block.BlockSize())
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, err
	}

	padded := pkcs7Pad(plaintext, block.BlockSize())
	ciphertext := make([]byte, len(padded))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(ciphertext, padded)

	return append(iv, ciphertext...), nil
}

func pkcs7Pad(data []byte, blockSize int) []byte {
	padding := blockSize - len(data)%blockSize
	return append(data, bytes.Repeat([]byte{byte(padding)}, padding)...)
}
