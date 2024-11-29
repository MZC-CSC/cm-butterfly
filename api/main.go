package main

import (
	"fmt"

	"github.com/cloud-barista/cm-butterfly/actions"
	v "github.com/cloud-barista/cm-butterfly/variables"
)

func init() {
	fmt.Println(v.Logo + v.TCR + v.Version + v.TCC)
	fmt.Println(v.Subtitle)
	fmt.Println(v.TCB + v.Repo + v.TCC)
	fmt.Println()
}

func main() {
	app := actions.App()
	app.HideBanner = true
	app.Logger.Fatal(app.Start(v.API_ADDR + ":" + v.API_PORT))
}
