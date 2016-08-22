#!/bin/bash

# 打包脚本
# By Horizon<root@yinhongbo.com>

ROOT=$(cd `dirname $0`; pwd)"/.."
ENV=$1

function execCmd(){
    CMD=$(echo "$1" | sed "s#;;;#__@@__#g")
    OLDIFS=$IFS;IFS=';';
    for CMDCell in $CMD
    do
        CMDCell=$(echo "$CMDCell" | sed "s#__@@__#;#g")
        res=$(eval "$CMDCell" 2>&1)
        if [ "$?" !=  "0" ];then
            echo  "The Shell encountered a fatal error. then exit.This is Error Info."
            eval "printf '%.0s=' {1..50};echo"
        echo "Run Commod: "$CMDCell
            echo "STDERR: "$res
            eval "printf '%.0s=' {1..50};echo"
            echo "please fix it. and go on..."
            exit 100
        fi
    done
    IFS=$OLDIFS
    return 0;
}

CMD=""
CMD=$CMD"cd $ROOT && rm -rf $ROOT/output && mkdir $ROOT/output;"
# install php
CMD=$CMD"composer install --prefer-dist;" #&& php artisan optimize;"
# install npm
CMD=$CMD"cd public/angulr/ && sh gaea.sh refresh && cd ../../;"

#  处理配置文件
if [ "$ENV" == "sit" ] ;then
    CMD=$CMD"cp .env.sit output/.env;"
elif [ "$ENV" == "test" ] ;then
    CMD=$CMD"cp .env.test output/.env;"
elif [ "$ENV" == "pre" ] ;then
    CMD=$CMD"cp .env.pre output/.env;"
else
    CMD=$CMD"cp .env.prod output/.env;"
fi

# COPY 处理要上线的文件/文件夹
CMD=$CMD"cd ${ROOT} && rsync -av * output --exclude output >> /dev/null 2>&1;"

CMD=$CMD"cd ${ROOT}/output;"
# 其他处理，如fis编译等
# fis -op ....

# 处理结束, 开始执行打包
execCmd "$CMD"

