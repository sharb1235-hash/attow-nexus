use serde_json::Value;

pub fn print_value(value: &Value, json: bool) -> anyhow::Result<()> {
    if json {
        println!("{}", serde_json::to_string_pretty(value)?);
    } else {
        print_human(value, 0);
    }
    Ok(())
}

fn print_human(value: &Value, indent: usize) {
    match value {
        Value::Array(items) => {
            for item in items {
                print_human(item, indent);
            }
        }
        Value::Object(map) => {
            for (key, value) in map {
                match value {
                    Value::Array(_) | Value::Object(_) => {
                        println!("{}{}:", " ".repeat(indent), key);
                        print_human(value, indent + 2);
                    }
                    _ => println!("{}{}: {}", " ".repeat(indent), key, scalar(value)),
                }
            }
            if indent == 0 {
                println!();
            }
        }
        _ => println!("{}", scalar(value)),
    }
}

fn scalar(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    }
}
