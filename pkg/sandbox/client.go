package sandbox

import (
	"context"
	"io"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
)

// DockerAPI abstracts Docker daemon operations used by the sandbox runner.
// This interface allows complete decoupling for mock-based unit tests.
type DockerAPI interface {
	ContainerCreate(
		ctx context.Context,
		config *container.Config,
		hostConfig *container.HostConfig,
		networkingConfig *network.NetworkingConfig,
		platform *v1.Platform,
		containerName string,
	) (container.CreateResponse, error)

	ContainerStart(
		ctx context.Context,
		containerID string,
		options container.StartOptions,
	) error

	ContainerWait(
		ctx context.Context,
		containerID string,
		condition container.WaitCondition,
	) (<-chan container.WaitResponse, <-chan error)

	ContainerLogs(
		ctx context.Context,
		container string,
		options container.LogsOptions,
	) (io.ReadCloser, error)

	ContainerKill(
		ctx context.Context,
		containerID string,
		signal string,
	) error

	ContainerRemove(
		ctx context.Context,
		containerID string,
		options container.RemoveOptions,
	) error
}

// NewDefaultDockerClient initializes a production Docker client using environment configuration
// and automatic API version negotiation.
func NewDefaultDockerClient() (DockerAPI, error) {
	return client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
}
