package handler

import (
	"github.com/gobuffalo/buffalo/render"
)

var r *render.Engine

func init() {
	r = render.New(render.Options{
		Helpers: render.Helpers{},
	})
}
