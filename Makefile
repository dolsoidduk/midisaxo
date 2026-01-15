#valid platform options: linux, win32, darwin

.NOTPARALLEL:

SRC_DIR            := $(realpath $(dir $(realpath $(lastword $(MAKEFILE_LIST)))))
BUILD_DIR_YARN     := $(SRC_DIR)/dist
BUILD_DIR_ELECTRON := $(SRC_DIR)/build
PLATFORM           := linux
ARCH               := x64
ELECTRON_VER       := 17.1.2
APP_TITLE          := OpenDeckConfigurator
PACKAGE_TITLE      := $(APP_TITLE)-$(PLATFORM)-$(ARCH)
FW_DIR             := $(SRC_DIR)/OpenDeck-firmware

# Default parallelism for firmware builds (override: make pico JOBS=4)
JOBS ?= $(shell nproc)

dev:
	@npm install --legacy-peer-deps
	@npm run dev

prod:
	@npm install --legacy-peer-deps
	@npm run build

pkg: prod
	@mkdir -p $(BUILD_DIR_ELECTRON)
	@cd $(BUILD_DIR_YARN) && \
	cp $(SRC_DIR)/package.json ./ && \
	cp $(SRC_DIR)/main.js ./ && \
	sed -i 's#/_assets#_assets#g' index.html && \
	npx electron-packager ./ $(APP_TITLE) --platform=$(PLATFORM) --arch=$(ARCH) --electron-version=$(ELECTRON_VER) --overwrite && \
	zip -r $(PACKAGE_TITLE).zip $(PACKAGE_TITLE)/ && \
	mv $(PACKAGE_TITLE).zip $(BUILD_DIR_ELECTRON)/

clean:
	@echo Cleaning up.
	@rm -rf $(BUILD_DIR_YARN)/ $(BUILD_DIR_ELECTRON)/

fw:
	@$(MAKE) -C $(FW_DIR) all TARGET=$(TARGET) DEBUG=$(DEBUG)

fw-test:
	@$(MAKE) -C $(FW_DIR) test TARGET=$(TARGET) DEBUG=$(DEBUG)

fw-flash:
	@$(MAKE) -C $(FW_DIR) flash TARGET=$(TARGET) DEBUG=$(DEBUG) \
		PROBE_ID=$(PROBE_ID) PORT=$(PORT) FLASH_TOOL=$(FLASH_TOOL) FLASH_BINARY_DIR=$(FLASH_BINARY_DIR)

fw-clean:
	@$(MAKE) -C $(FW_DIR) clean

# Convenience shortcuts
pico:
	@$(MAKE) -C $(FW_DIR) -j$(JOBS) all TARGET=midisaxo_pico
	@test -f $(FW_DIR)/build/midisaxo_pico/release/merged.uf2
	@echo "UF2: OpenDeck-firmware/build/midisaxo_pico/release/merged.uf2"

xiao:
	@$(MAKE) -C $(FW_DIR) -j$(JOBS) all TARGET=midisaxo_xiao_rp2040
	@test -f $(FW_DIR)/build/midisaxo_xiao_rp2040/release/merged.uf2
	@echo "UF2: OpenDeck-firmware/build/midisaxo_xiao_rp2040/release/merged.uf2"

#debugging
print-%:
	@echo '$($*)'

.PHONY: dev prod pkg clean fw fw-test fw-flash fw-clean pico xiao print-%