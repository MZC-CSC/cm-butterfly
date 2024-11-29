```
go install github.com/cosmtrek/air@v1.40.0
export PATH=$(go env GOPATH)/bin:$PATH
air
```

```
go install github.com/swaggo/swag/cmd/swag@latest
docker run --rm -v $(pwd):/code ghcr.io/swaggo/swag:latest
swag init -g actions/app.go
 -- swag fmt
```