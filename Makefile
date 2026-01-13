#valid platform options: linux, win32, darwin

SRC_DIR            := $(realpath $(dir $(realpath $(lastword $(MAKEFILE_LIST)))))
BUILD_DIR_YARN     := $(SRC_DIR)/dist
BUILD_DIR_ELECTRON := $(SRC_DIR)/build
PLATFORM           := linux
ARCH               := x64
ELECTRON_VER       := 17.1.2
APP_TITLE          := OpenDeckConfigurator
PACKAGE_TITLE      := $(APP_TITLE)-$(PLATFORM)-$(ARCH)

dev:
	@yarn
	@yarn dev

# npm 기반 개발/빌드(현재 repo에 package-lock.json이 있고, yarn.lock이 깨진 환경에서도 동작)
dev-npm:
	@npm ci --legacy-peer-deps || npm install --legacy-peer-deps
	@npm run dev

prod:
	@yarn
	@VITE_BUILD_ID="$$(date +%Y%m%d-%H%M%S)-$$(cd $(SRC_DIR)/.. && git rev-parse --short HEAD 2>/dev/null || echo nogit)" yarn build

prod-npm:
	@npm ci --legacy-peer-deps || npm install --legacy-peer-deps
	@VITE_BUILD_ID="$$(date +%Y%m%d-%H%M%S)-$$(cd $(SRC_DIR)/.. && git rev-parse --short HEAD 2>/dev/null || echo nogit)" npm run build

pkg:
	@mkdir -p $(BUILD_DIR_ELECTRON)
	@cd $(BUILD_DIR_YARN) && \
	STAMP=$$(date +%Y%m%d-%H%M%S) && \
	GIT=$$(cd $(SRC_DIR)/.. && git rev-parse --short HEAD 2>/dev/null || echo nogit) && \
	BUILD_ID=$${STAMP}-$${GIT} && \
	cp $(SRC_DIR)/package.json ./ && \
	cp $(SRC_DIR)/main.js ./ && \
	echo "window.__OPENDECK_BUILD_ID__='$${BUILD_ID}';" > build-id.js && \
	sed -i 's#/_assets#_assets#g' index.html && \
	sed -i 's#</head>#<script src="./build-id.js"></script></head>#' index.html && \
	electron-packager ./ $(APP_TITLE) --platform=$(PLATFORM) --arch=$(ARCH) --electron-version=$(ELECTRON_VER) --overwrite && \
	zip -r $(PACKAGE_TITLE).zip $(PACKAGE_TITLE)/ && \
	mv $(PACKAGE_TITLE).zip $(BUILD_DIR_ELECTRON)/ && \
	cd $(BUILD_DIR_ELECTRON) && \
	cp -f $(PACKAGE_TITLE).zip $(PACKAGE_TITLE)-$${STAMP}-$${GIT}.zip

pkg-npm: prod-npm
	@mkdir -p $(BUILD_DIR_ELECTRON)
	@cd $(BUILD_DIR_YARN) && \
	STAMP=$$(date +%Y%m%d-%H%M%S) && \
	GIT=$$(cd $(SRC_DIR)/.. && git rev-parse --short HEAD 2>/dev/null || echo nogit) && \
	BUILD_ID=$${STAMP}-$${GIT} && \
	cp $(SRC_DIR)/package.json ./ && \
	cp $(SRC_DIR)/main.js ./ && \
	echo "window.__OPENDECK_BUILD_ID__='$${BUILD_ID}';" > build-id.js && \
	sed -i 's#/_assets#_assets#g' index.html && \
	sed -i 's#</head>#<script src="./build-id.js"></script></head>#' index.html && \
	electron-packager ./ $(APP_TITLE) --platform=$(PLATFORM) --arch=$(ARCH) --electron-version=$(ELECTRON_VER) --overwrite && \
	zip -r $(PACKAGE_TITLE).zip $(PACKAGE_TITLE)/ && \
	mv $(PACKAGE_TITLE).zip $(BUILD_DIR_ELECTRON)/ && \
	cd $(BUILD_DIR_ELECTRON) && \
	cp -f $(PACKAGE_TITLE).zip $(PACKAGE_TITLE)-$${STAMP}-$${GIT}.zip

clean:
	@echo Cleaning up.
	@rm -rf $(BUILD_DIR_YARN)/ $(BUILD_DIR_ELECTRON)/

#debugging
print-%:
	@echo '$($*)'