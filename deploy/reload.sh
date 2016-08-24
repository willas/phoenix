#!/bin/bash


ps aux|grep "supervisord" | grep -v grep | awk  '{print $2}' |xargs kill >> /dev/null 2>&1
ps aux|grep "fetcher.js" | grep -v grep | awk  '{print $2}' |xargs kill >> /dev/null 2>&1
ps aux|grep "report.js" | grep -v grep | awk  '{print $2}' |xargs kill >> /dev/null 2>&1
ps aux|grep "index2.js" | grep -v grep | awk  '{print $2}' |xargs kill >> /dev/null 2>&1
ps aux|grep "phantom/lib/shim.js" | grep -v grep | awk  '{print $2}' |xargs kill >> /dev/null 2>&1

/usr/bin/python /usr/bin/supervisord -c /var/wd/wrs/webroot/phoenix/deploy/supervisord.conf
