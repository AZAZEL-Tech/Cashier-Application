#!/bin/bash
# =================================================================
# Script Otomatis Instalasi LAMP & Setup Database WarungKu POS
# =================================================================

set -e

echo "=========================================================="
echo "  🚀 MEMULAI INSTALASI LAMP (Apache, MariaDB, PHP) 🚀"
echo "=========================================================="

echo "1. Mengupdate daftar paket & menginstal database..."
sudo apt update
sudo apt install -y mariadb-server apache2 php php-mysql phpmyadmin

echo "2. Menjalankan service MariaDB & Apache..."
sudo systemctl start mariadb apache2 || sudo service mariadb start
sudo systemctl enable mariadb apache2 2>/dev/null || true

echo "3. Mengatur hak akses database root..."
sudo mysql -e "GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD(''); FLUSH PRIVILEGES;" 2>/dev/null || sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY ''; FLUSH PRIVILEGES;" 2>/dev/null || true

echo "4. Mengimpor database WarungKu POS..."
cd "$(dirname "$0")"
python3 setup_mysql.py

echo "=========================================================="
echo "🎉 INSTALASI & SETUP SELESAI!"
echo "Aplikasi kasir kini sudah terhubung ke database MySQL / MariaDB!"
echo "Buka phpMyAdmin di: http://localhost/phpmyadmin"
echo "=========================================================="
