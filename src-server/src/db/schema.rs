use rusqlite::Connection;
use rand::{distributions::Alphanumeric, Rng};
use sha2::{Digest, Sha256};

pub fn create_tables(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS screenplay_projects (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            name TEXT,
            init_json TEXT,
            current_step INTEGER DEFAULT 1,
            done_steps TEXT DEFAULT '[]',
            steps_json TEXT DEFAULT '{}',
            selections_json TEXT DEFAULT '{}',
            selfchecks_json TEXT DEFAULT '{}',
            checkpoints_json TEXT DEFAULT '{}',
            structural_choices_json TEXT DEFAULT '{}',
            linked_script_task_id TEXT,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          parent_id TEXT,
          name TEXT NOT NULL,
          module_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          metadata_json TEXT DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (parent_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS script_tasks (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          mode TEXT NOT NULL,
          input_summary TEXT,
          genre TEXT,
          style TEXT,
          duration TEXT,
          stage TEXT NOT NULL DEFAULT 'idle',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS script_outputs (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          characters_json TEXT,
          plot_outline TEXT,
          script_body TEXT,
          hook_opening TEXT,
          storyboard_base TEXT,
          raw_response TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES script_tasks(id)
        );

        CREATE TABLE IF NOT EXISTS image_tasks (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          mode TEXT NOT NULL,
          source_script TEXT,
          visual_style TEXT,
          image_goal TEXT,
          stage TEXT NOT NULL DEFAULT 'idle',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS image_outputs (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          sections_json TEXT,
          raw_response TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES image_tasks(id)
        );

        CREATE TABLE IF NOT EXISTS video_tasks (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          mode TEXT NOT NULL,
          script_beats TEXT,
          video_style TEXT,
          motion_focus TEXT,
          stage TEXT NOT NULL DEFAULT 'idle',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS video_outputs (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          sections_json TEXT,
          raw_response TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES video_tasks(id)
        );

        CREATE TABLE IF NOT EXISTS video_review_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          score INTEGER,
          status TEXT NOT NULL,
          summary TEXT,
          issues_json TEXT,
          suggestions_json TEXT,
          review_model TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES video_tasks(id)
        );

        CREATE TABLE IF NOT EXISTS image_review_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          score INTEGER,
          status TEXT NOT NULL,
          summary TEXT,
          issues_json TEXT,
          suggestions_json TEXT,
          review_model TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES image_tasks(id)
        );

        CREATE TABLE IF NOT EXISTS review_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          score INTEGER,
          status TEXT NOT NULL,
          summary TEXT,
          issues_json TEXT,
          suggestions_json TEXT,
          dimensions_json TEXT,
          priority_json TEXT,
          rewrite_example TEXT,
          review_model TEXT,
          surgery_table_json TEXT,
          revision_path_json TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES script_tasks(id)
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          id TEXT PRIMARY KEY,
          setting_key TEXT NOT NULL UNIQUE,
          setting_value TEXT,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS asset_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          asset_type TEXT NOT NULL,
          asset_data_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES script_tasks(id)
        );

        CREATE TRIGGER IF NOT EXISTS asset_records_expand_legacy_characters
        AFTER INSERT ON asset_records
        WHEN NEW.asset_type = 'characters'
          AND json_valid(NEW.asset_data_json)
          AND json_type(NEW.asset_data_json) = 'array'
        BEGIN
          INSERT INTO asset_records (id, task_id, asset_type, asset_data_json, created_at)
          SELECT lower(hex(randomblob(16))), NEW.task_id, 'character', value, NEW.created_at
          FROM json_each(NEW.asset_data_json);
          DELETE FROM asset_records WHERE id = NEW.id;
        END;

        CREATE TRIGGER IF NOT EXISTS asset_records_expand_legacy_scenes
        AFTER INSERT ON asset_records
        WHEN NEW.asset_type = 'scenes'
          AND json_valid(NEW.asset_data_json)
          AND json_type(NEW.asset_data_json) = 'array'
        BEGIN
          INSERT INTO asset_records (id, task_id, asset_type, asset_data_json, created_at)
          SELECT lower(hex(randomblob(16))), NEW.task_id, 'scene', value, NEW.created_at
          FROM json_each(NEW.asset_data_json);
          DELETE FROM asset_records WHERE id = NEW.id;
        END;

        CREATE TRIGGER IF NOT EXISTS asset_records_expand_legacy_props
        AFTER INSERT ON asset_records
        WHEN NEW.asset_type = 'props'
          AND json_valid(NEW.asset_data_json)
          AND json_type(NEW.asset_data_json) = 'array'
        BEGIN
          INSERT INTO asset_records (id, task_id, asset_type, asset_data_json, created_at)
          SELECT lower(hex(randomblob(16))), NEW.task_id, 'prop', value, NEW.created_at
          FROM json_each(NEW.asset_data_json);
          DELETE FROM asset_records WHERE id = NEW.id;
        END;

        CREATE TABLE IF NOT EXISTS prompt_output_records (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          grid_groups_json TEXT NOT NULL,
          seedance_groups_json TEXT NOT NULL,
          generation_model TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES script_tasks(id)
        );

        CREATE TABLE IF NOT EXISTS seedance_analysis (
          task_id TEXT PRIMARY KEY,
          paragraph_index_json TEXT NOT NULL,
          structure_type TEXT,
          emotion_map_json TEXT NOT NULL,
          units_plan_json TEXT NOT NULL,
          total_sec INTEGER,
          total_units INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES script_tasks(id)
        );

        CREATE TABLE IF NOT EXISTS seedance_units (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          unit_index INTEGER NOT NULL,
          duration_sec INTEGER,
          scene_type TEXT,
          sub_shot_count INTEGER,
          copy_area TEXT,
          note_area_json TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          retry_count INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(task_id, unit_index),
          FOREIGN KEY (task_id) REFERENCES script_tasks(id)
        );

        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL DEFAULT '',
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          token TEXT,
          refresh_token TEXT,
          last_login_at TEXT,
          last_seen_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS visual_prompt_outputs (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          script_task_id TEXT,
          asset_type TEXT,
          asset_id TEXT,
          shot_id TEXT,
          output_type TEXT NOT NULL,
          template_id TEXT,
          title TEXT NOT NULL,
          prompt_text TEXT NOT NULL,
          prompt_text_en TEXT DEFAULT '',
          review_text_zh TEXT DEFAULT '',
          source_asset_snapshot_json TEXT DEFAULT '{}',
          source_asset_hash TEXT DEFAULT '',
          selected_template_ids_json TEXT DEFAULT '[]',
          generation_mode TEXT DEFAULT 'image',
          quality_json TEXT DEFAULT '{}',
          prompt_language TEXT DEFAULT 'zh',
          platform_preset TEXT,
          params_json TEXT,
          attribution_json TEXT,
          version INTEGER DEFAULT 1,
          favorite INTEGER DEFAULT 0,
          user_note TEXT DEFAULT '',
          platform_note TEXT DEFAULT '',
          copied_count INTEGER DEFAULT 0,
          last_copied_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS visual_prompt_templates (
          id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          source_repo TEXT,
          source_url TEXT,
          source_license TEXT,
          source_commit TEXT,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT,
          subcategory TEXT,
          style_tags_json TEXT,
          subject_tags_json TEXT,
          language TEXT,
          prompt_text TEXT NOT NULL,
          arguments_json TEXT,
          preview_images_json TEXT,
          author TEXT,
          original_source_url TEXT,
          published_at TEXT,
          imported_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS visual_prompt_batches (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          script_task_id TEXT,
          batch_type TEXT NOT NULL,
          output_ids_json TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS asset_images (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          task_id TEXT,
          asset_type TEXT NOT NULL,
          asset_id TEXT,
          asset_name TEXT,
          category TEXT NOT NULL DEFAULT 'reference',
          file_path TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_size INTEGER DEFAULT 0,
          mime_type TEXT DEFAULT 'image/png',
          width INTEGER,
          height INTEGER,
          source_prompt_id TEXT,
          source_template_id TEXT,
          source_platform TEXT,
          visual_identity_json TEXT,
          tags_json TEXT,
          note TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS episodes (
          id TEXT PRIMARY KEY,
          series_project_id TEXT NOT NULL,
          episode_project_id TEXT,
          script_task_id TEXT,
          episode_index INTEGER NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          source_summary TEXT DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(series_project_id, episode_index),
          FOREIGN KEY (series_project_id) REFERENCES projects(id),
          FOREIGN KEY (episode_project_id) REFERENCES projects(id),
          FOREIGN KEY (script_task_id) REFERENCES script_tasks(id)
        );

        CREATE TABLE IF NOT EXISTS source_materials (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          name TEXT NOT NULL,
          material_type TEXT NOT NULL DEFAULT 'unknown',
          file_path TEXT,
          file_name TEXT,
          file_hash TEXT,
          mime_type TEXT,
          encoding TEXT,
          content_text TEXT NOT NULL,
          metadata_json TEXT DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS source_chunks (
          id TEXT PRIMARY KEY,
          source_material_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          title TEXT NOT NULL,
          start_char INTEGER NOT NULL DEFAULT 0,
          end_char INTEGER NOT NULL DEFAULT 0,
          content_text TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'suggested',
          metadata_json TEXT DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(source_material_id, chunk_index),
          FOREIGN KEY (source_material_id) REFERENCES source_materials(id)
        );

        CREATE TABLE IF NOT EXISTS episode_source_links (
          id TEXT PRIMARY KEY,
          episode_id TEXT NOT NULL,
          source_chunk_id TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          UNIQUE(episode_id, source_chunk_id),
          FOREIGN KEY (episode_id) REFERENCES episodes(id),
          FOREIGN KEY (source_chunk_id) REFERENCES source_chunks(id)
        );

        CREATE TABLE IF NOT EXISTS story_state_snapshots (
          id TEXT PRIMARY KEY,
          episode_id TEXT,
          script_task_id TEXT,
          snapshot_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (episode_id) REFERENCES episodes(id),
          FOREIGN KEY (script_task_id) REFERENCES script_tasks(id)
        );

        CREATE TABLE IF NOT EXISTS asset_sheet_batches (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          task_id TEXT,
          asset_type TEXT NOT NULL DEFAULT 'prop',
          title TEXT NOT NULL,
          grid_rows INTEGER NOT NULL,
          grid_cols INTEGER NOT NULL,
          source_prompt TEXT NOT NULL,
          sheet_file_path TEXT,
          status TEXT NOT NULL DEFAULT 'planned',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id),
          FOREIGN KEY (task_id) REFERENCES script_tasks(id)
        );

        CREATE TABLE IF NOT EXISTS asset_sheet_cells (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          asset_id TEXT NOT NULL,
          asset_name TEXT NOT NULL,
          row_index INTEGER NOT NULL,
          col_index INTEGER NOT NULL,
          x INTEGER,
          y INTEGER,
          width INTEGER,
          height INTEGER,
          child_image_id TEXT,
          child_file_path TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(batch_id, row_index, col_index),
          FOREIGN KEY (batch_id) REFERENCES asset_sheet_batches(id),
          FOREIGN KEY (child_image_id) REFERENCES asset_images(id)
        );
        ",
    )?;

    ensure_projects_columns(conn)?;
    ensure_users_columns(conn)?;
    ensure_visual_prompt_output_columns(conn)?;

    Ok(())
}

pub fn ensure_admin_user(
    conn: &Connection,
    config: &crate::config::ServerConfig,
) -> Result<(), Box<dyn std::error::Error>> {
    if config.admin_username.trim().is_empty() || config.admin_password.is_empty() {
        return Ok(());
    }

    let salt = generate_salt();
    let hashed = hash_password(&config.admin_password, &salt);
    let email = if config.admin_email.trim().is_empty() {
        format!("{}@scriptstack.local", config.admin_username.trim())
    } else {
        config.admin_email.trim().to_string()
    };

    conn.execute(
        "INSERT INTO users (username, email, password_hash, salt, role, refresh_token, created_at)
         VALUES (?1, ?2, ?3, ?4, 'admin', ?5, datetime('now'))
         ON CONFLICT(username) DO UPDATE SET
           email = excluded.email,
           password_hash = excluded.password_hash,
           salt = excluded.salt,
           role = 'admin'",
        rusqlite::params![
            config.admin_username.trim(),
            email,
            hashed,
            salt,
            uuid::Uuid::new_v4().to_string(),
        ],
    )?;

    Ok(())
}

fn hash_password(password: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(salt.as_bytes());
    hex::encode(hasher.finalize())
}

fn generate_salt() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(16)
        .map(char::from)
        .collect()
}

fn ensure_projects_columns(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    for sql in [
        "ALTER TABLE projects ADD COLUMN parent_id TEXT",
        "ALTER TABLE projects ADD COLUMN metadata_json TEXT DEFAULT '{}'",
    ] {
        if let Err(err) = conn.execute(sql, []) {
            let msg = err.to_string().to_lowercase();
            if !msg.contains("duplicate column") {
                return Err(Box::new(err));
            }
        }
    }
    Ok(())
}

fn ensure_users_columns(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    for sql in [
        "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
        "ALTER TABLE users ADD COLUMN last_login_at TEXT",
        "ALTER TABLE users ADD COLUMN last_seen_at TEXT",
    ] {
        if let Err(err) = conn.execute(sql, []) {
            let msg = err.to_string().to_lowercase();
            if !msg.contains("duplicate column") {
                return Err(Box::new(err));
            }
        }
    }
    Ok(())
}

fn ensure_visual_prompt_output_columns(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let migrations = [
        "ALTER TABLE visual_prompt_outputs ADD COLUMN user_note TEXT DEFAULT ''",
        "ALTER TABLE visual_prompt_outputs ADD COLUMN platform_note TEXT DEFAULT ''",
        "ALTER TABLE visual_prompt_outputs ADD COLUMN copied_count INTEGER DEFAULT 0",
        "ALTER TABLE visual_prompt_outputs ADD COLUMN last_copied_at TEXT",
        "ALTER TABLE visual_prompt_outputs ADD COLUMN prompt_text_en TEXT DEFAULT ''",
        "ALTER TABLE visual_prompt_outputs ADD COLUMN review_text_zh TEXT DEFAULT ''",
        "ALTER TABLE visual_prompt_outputs ADD COLUMN source_asset_snapshot_json TEXT DEFAULT '{}'",
        "ALTER TABLE visual_prompt_outputs ADD COLUMN source_asset_hash TEXT DEFAULT ''",
        "ALTER TABLE visual_prompt_outputs ADD COLUMN selected_template_ids_json TEXT DEFAULT '[]'",
        "ALTER TABLE visual_prompt_outputs ADD COLUMN generation_mode TEXT DEFAULT 'image'",
        "ALTER TABLE visual_prompt_outputs ADD COLUMN quality_json TEXT DEFAULT '{}'",
    ];

    for sql in migrations {
        if let Err(err) = conn.execute(sql, []) {
            let msg = err.to_string().to_lowercase();
            if !msg.contains("duplicate column") {
                return Err(Box::new(err));
            }
        }
    }

    Ok(())
}
