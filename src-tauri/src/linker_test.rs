use std::fs;
use tempfile::TempDir;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_symlink() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("source.txt");
        let target = temp_dir.path().join("target.txt");

        // 创建源文件
        fs::write(&source, b"test content").unwrap();

        // 创建符号链接
        let result = crate::linker::create_symlink(&source, &target);

        assert!(result.is_ok());
        assert!(target.exists());
        assert_eq!(target.read_link().unwrap(), source);

        // 验证内容一致
        let content = fs::read_to_string(&target).unwrap();
        assert_eq!(content, "test content");
    }

    #[test]
    fn test_create_copy_fallback() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("source.txt");
        let target = temp_dir.path().join("target.txt");

        fs::write(&source, b"test content").unwrap();

        // 使用复制方式
        let result = crate::linker::create_copy(&source, &target);

        assert!(result.is_ok());
        assert!(target.exists());

        // 验证是副本而不是链接
        assert!(target.read_link().is_err());

        let content = fs::read_to_string(&target).unwrap();
        assert_eq!(content, "test content");
    }

    #[test]
    fn test_remove_link() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("source.txt");
        let target = temp_dir.path().join("target.txt");

        fs::write(&source, b"test content").unwrap();
        crate::linker::create_symlink(&source, &target).unwrap();

        assert!(target.exists());

        let result = crate::linker::remove_link(&target);

        assert!(result.is_ok());
        assert!(!target.exists());
    }

    #[test]
    fn test_verify_link() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("source.txt");
        let target = temp_dir.path().join("target.txt");

        fs::write(&source, b"test content").unwrap();
        crate::linker::create_symlink(&source, &target).unwrap();

        assert!(crate::linker::verify_link(&source, &target));

        // 删除源文件，链接应该失效
        fs::remove_file(&source).unwrap();
        assert!(!crate::linker::verify_link(&source, &target));
    }
}
