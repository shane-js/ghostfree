module github.com/example/myapp

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/stretchr/testify v1.8.4
	golang.org/x/net v0.14.0
	// vrc-exact + vrc-prerelease
	github.com/example/prerelease v1.0.0-beta.1
	// vrc-exact + vrc-build-metadata
	github.com/example/buildmeta v2.0.0+build.123
)

require golang.org/x/text v0.12.0 // indirect

replace github.com/old/pkg => github.com/new/pkg v1.0.0
