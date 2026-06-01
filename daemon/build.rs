fn main() -> Result<(), Box<dyn std::error::Error>> {
    let protoc = protoc_bin_vendored::protoc_bin_path()?;
    unsafe {
        std::env::set_var("PROTOC", protoc);
    }

    tonic_build::configure()
        .build_client(true)
        .build_server(true)
        .compile_protos(
            &[
                "../proto/nexus/v1/common.proto",
                "../proto/nexus/v1/ledger.proto",
                "../proto/nexus/v1/ipc.proto",
                "../proto/nexus/v1/service.proto",
                "../proto/nexus/v1/mcp.proto",
            ],
            &["../proto"],
        )?;
    println!("cargo:rerun-if-changed=../proto/nexus/v1");
    Ok(())
}
