# EC2 Docker Deployment

This backend is configured to run on EC2 with Docker Compose behind Nginx. The public API URL is:

```text
https://api.mywatchbox.net
```

## 1. Prepare EC2

Open these inbound ports in the EC2 security group:

```text
22/tcp    your IP only
80/tcp    0.0.0.0/0
443/tcp   0.0.0.0/0
```

Do not expose port `4000`, MongoDB, Redis, or RabbitMQ publicly. The compose file binds those ports to `127.0.0.1` on the EC2 host, and Nginx is the public entrypoint.

Create a DNS record:

```text
Type: A
Name: api
Value: 3.229.39.230
```

Install Docker on Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and back in after adding your user to the Docker group.

## 2. Upload The Backend

Clone the repository on EC2:

```bash
git clone https://github.com/SaifulET/watchBox.git
cd watchBox
```

Or upload the project folder with `scp` if you are not deploying from Git.

## 3. Configure Environment

Create the production `.env` file:

```bash
cp .env.ec2.example .env
nano .env
```

Replace every `replace-with-*` value and add real provider keys for S3, SMTP, Stripe, eBay, FCM, and AI if those services are enabled.

Important production values:

```text
API_PUBLIC_URL=https://api.mywatchbox.net
TRUST_PROXY=true
EBAY_REDIRECT_URI=https://api.mywatchbox.net/api/v1/admin/marketplaces/ebay/callback
```

## 4. Start The Backend

```bash
docker compose up -d --build
docker compose ps
```

Check the API locally on EC2:

```bash
curl http://127.0.0.1:4000/health/live
curl http://127.0.0.1:4000/health/ready
```

## 5. Configure Nginx

Install the included Nginx site:

```bash
sudo cp deploy/nginx/api.mywatchbox.net.conf /etc/nginx/sites-available/api.mywatchbox.net
sudo ln -s /etc/nginx/sites-available/api.mywatchbox.net /etc/nginx/sites-enabled/api.mywatchbox.net
sudo nginx -t
sudo systemctl reload nginx
```

Verify the domain over HTTP:

```bash
curl http://api.mywatchbox.net/health/live
```

Enable HTTPS with Let's Encrypt:

```bash
sudo certbot --nginx -d api.mywatchbox.net
sudo nginx -t
sudo systemctl reload nginx
```

Check the final public API:

```bash
curl https://api.mywatchbox.net/health/live
curl https://api.mywatchbox.net/health/ready
```

View logs:

```bash
docker compose logs -f api
docker compose logs -f worker
```

## 6. Update Later

```bash
git pull
docker compose up -d --build
docker image prune -f
```
