# default target that depends on moveLogs
.DEFAULT_GOAL := main

main: moveLogs run

# cloudflared tunnel run test &> logs/cloudflared.log &
# single backup of logs
moveLogs:
	mkdir -p logs || true
	mkdir -p .logs_old || true
	mv -f logs/* .logs_old/ || true

run: moveLogs
	docker compose up -d
	docker compose logs -f > logs/docker.log &

setup:
	make run
	make fixPermissions
	make restart

dockerSystemReset:
	make stop
	docker image prune -a -f
	docker volume prune -f
	docker network prune -f
	docker system prune -a -f --volumes

resetLocal:
	make stop || true


stop: moveLogs
	docker compose down

restart:
	make stop || true
	timeout 5.0s make run

fixPermissions:
	sudo sh -c ' \
		chown -R 999:999 data/mongodb_data logs .logs_old && \
		chmod -R 0755 data/mongodb_data && \
		[ -d logs ] && chmod -R 0777 logs && \
		[ -d .logs_old ] && chmod -R 0777 .logs_old \
	'

status:
	@echo "============================================================="
	@echo "Docker"
	@docker ps
	@echo "-------------------------------------------------------------"
	@echo "Cloudflared"
	@pgrep -a cloudflared || echo "Cloudflared is not running."
	@echo "============================================================="
