.PHONY: dev daemon cli test lint dashboard docker proto bench audit

dev:
	cargo run -p nexus -- daemon start

daemon:
	cargo build -p nexusd

cli:
	cargo build -p nexus

test:
	cargo test --workspace
	cd sdks/typescript && npm.cmd test

lint:
	cargo fmt --all -- --check
	cargo clippy --workspace -- -D warnings
	cd sdks/typescript && npm.cmd run lint

dashboard:
	cd dashboard && npm.cmd install && npm.cmd run build

docker:
	docker build -t nexus:local .

proto:
	buf lint
	buf generate

bench:
	cargo run -p nexus -- bench local --events 10000 --payload-size 4096

audit:
	cargo audit
	cd dashboard && npm.cmd audit
	cd sdks/typescript && npm.cmd audit
