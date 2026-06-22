package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
)

// Encryptor wraps an AES-GCM cipher derived from a passphrase (e.g. JWT secret
// or a dedicated ENCRYPTION_KEY env var). Used to store third-party API keys
// (OpenAI, Anthropic, etc.) encrypted at rest in the database.
type Encryptor struct {
	gcm cipher.AEAD
}

func New(passphrase string) (*Encryptor, error) {
	// Derive a fixed 32-byte key from the passphrase via SHA-256.
	key := sha256.Sum256([]byte(passphrase))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Encryptor{gcm: gcm}, nil
}

func (e *Encryptor) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	nonce := make([]byte, e.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := e.gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (e *Encryptor) Decrypt(encoded string) (string, error) {
	if encoded == "" {
		return "", nil
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	nonceSize := e.gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := e.gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// Mask returns a display-safe preview of a secret, e.g. "sk-...a1b2".
func Mask(secret string) string {
	if len(secret) <= 8 {
		return "••••••••"
	}
	return secret[:3] + "••••••••" + secret[len(secret)-4:]
}
