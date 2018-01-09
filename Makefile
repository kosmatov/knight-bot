.PHONY: test deploy

PROFILE=default
NODE_ENV=development
LOG_LEVEL=3
PID=$(shell ps ax | grep telegram-cli | grep $(PROFILE) | grep -v grep | awk '{print $$1}')

install:
	NODE_ENV=$(NODE_ENV) yarn install
test:
	node_modules/mocha/bin/mocha test --recursive
start:
	$(MAKE) -s stop
	$(MAKE) -s forcestop
	NODE_ENV=$(NODE_ENV) PROFILE=$(PROFILE) LOG_LEVEL=$(LOG_LEVEL) node knight-bot.js
stop:
	[ -z "$(PID)" ] || kill -TERM $(PID)
forcestop:
	[ -z "$(PID)" ] || kill -KILL $(PID)
restart:
	$(MAKE) -s start
deploy:
	ansible-playbook -i deploy/hosts deploy/deploy.yml
start-app:
	ansible-playbook -i deploy/hosts deploy/restart.yml
restart-app:
	ansible-playbook -i deploy/hosts deploy/restart.yml
stop-app:
	ansible-playbook -i deploy/hosts deploy/stop.yml
