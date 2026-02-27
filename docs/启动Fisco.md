**启动node**
cd ./nodes/127.0.0.1
bash start_all.sh

**启动webase**
cd webase-front
bash start.sh

**ip不对**
sudo ip link set ens33 up
sudo dhclient ens33
ip addr show ens33

**Prisma Studio启动**
cd d:\code\ConfChain\apps\api; pnpm exec prisma studio