package mciammanager

type mciammanagerAccessTokenResponse struct {
	AccessToken      string `json:"access_token" mapstructure:"access_token"`
	ExpiresIn        int    `json:"expires_in" mapstructure:"expires_in"`
	RefreshExpiresIn int    `json:"refresh_expires_in" mapstructure:"refresh_expires_in"`
	RefreshToken     string `json:"refresh_token" mapstructure:"refresh_token"`
	TokenType        string `json:"token_type" mapstructure:"token_type"`
	NotBeforePolicy  int    `json:"not-before-policy" mapstructure:"not-before-policy"`
	SessionState     string `json:"session_state" mapstructure:"session_state"`
	Scope            string `json:"scope" mapstructure:"scope"`
}
