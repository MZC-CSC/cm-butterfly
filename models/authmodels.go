package models

type AccessTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type AccessTokenResponse struct {
	AccessToken      string `json:"access_token"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
	RefreshToken     string `json:"refresh_token"`
	TokenType        string `json:"token_type"`
	NotBeforePolicy  int    `json:"not-before-policy"`
	SessionState     string `json:"session_state"`
	Scope            string `json:"scope"`
}

type UserLogin struct {
	Id       string `json:"id"`
	Password string `json:"password"`
}

type UserInfo struct {
	FamilyName       string `json:"family_name"`
	GivenName        string `json:"given_name"`
	Name             string `json:"name"`
	PreferredUsename string `json:"preferred_username"`
	Sub              string `json:"sub"`
}
