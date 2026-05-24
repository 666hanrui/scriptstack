pub mod crud;
pub mod schema;

use rusqlite::Connection;
use std::path::Path;

pub fn open_database_connection(db_path: &Path) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        "
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;
        PRAGMA busy_timeout=15000;
        ",
    )?;
    Ok(conn)
}

pub fn init_database(db_path: &Path) -> Result<Connection, Box<dyn std::error::Error>> {
    let conn = open_database_connection(db_path)?;

    schema::create_tables(&conn)?;

    Ok(conn)
}
