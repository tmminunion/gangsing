#!/bin/bash

# Konfigurasi - Solusi paling ringan (480p/15fps)
DISPLAY_NUM=":99"
RESOLUTION="854x480"
FPS="15"
URL="http://localhost:3010?stream=true"
YOUTUBE_URL="rtmp://a.rtmp.youtube.com/live2"
STREAM_KEY="dzgr-p9g7-6ubq-cftv-1wf5"

# 1. Bersihkan sisa proses secara paksa
pkill -9 -f Xvfb
pkill -9 -f google-chrome
pkill -9 -f ffmpeg
sleep 2

# 2. Jalankan Virtual Display
Xvfb $DISPLAY_NUM -screen 0 ${RESOLUTION}x24 -ac +extension GLX +render -noreset &
sleep 2

# 3. Jalankan Browser (GPU disabled untuk kompatibilitas headless)
DISPLAY=$DISPLAY_NUM google-chrome \
    --no-first-run \
    --no-sandbox \
    --disable-setuid-sandbox \
    --disable-infobars \
    --disable-notifications \
    --window-size=854,480 \
    --window-position=0,0 \
    --kiosk \
    --force-device-scale-factor=1 \
    --disable-gpu \
    --disable-dev-shm-usage \
    --app=$URL &

sleep 15

# 4. Mulai Streaming FFmpeg 480p/15fps (Solusi paling ringan)
DISPLAY=$DISPLAY_NUM ffmpeg -thread_queue_size 512 -f x11grab -r $FPS -s $RESOLUTION -i $DISPLAY_NUM \
    -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
    -vcodec libx264 -preset ultrafast -tune zerolatency -crf 28 -maxrate 2000k -bufsize 4000k \
    -pix_fmt yuv420p -g 30 \
    -acodec aac -b:a 64k -shortest \
    -f flv "$YOUTUBE_URL/$STREAM_KEY"
