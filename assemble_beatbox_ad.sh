#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/beatbox

PHONE=/home/ubuntu/webdev-static-assets/beatbox_ref_phone.png
PRODUCER=/home/ubuntu/webdev-static-assets/beatbox_ref_producer.png
ARTIST=/home/ubuntu/webdev-static-assets/beatbox_ref_artist.png
CLIP1=/home/ubuntu/beatbox/beatbox_ad_clip1.mp4
BGM=/home/ubuntu/beatbox/beatbox_ad_bgm.wav
VO=/home/ubuntu/beatbox/beatbox_ad_voiceover.wav
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf

# Create three animated still segments with controlled vertical motion and legible post-added copy.
ffmpeg -y -loop 1 -i "$PRODUCER" -t 6 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0015,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=180:s=1080x1920:fps=30,drawbox=x=0:y=0:w=iw:h=230:color=black@0.30:t=fill,drawtext=fontfile=$FONT:text='DISCOVER YOUR SOUND':fontcolor=white:fontsize=58:x=70:y=92:shadowcolor=black@0.7:shadowx=2:shadowy=2" -an -c:v libx264 -pix_fmt yuv420p -r 30 /home/ubuntu/beatbox/seg2.mp4

ffmpeg -y -loop 1 -i "$ARTIST" -t 6 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0012,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=180:s=1080x1920:fps=30,drawbox=x=0:y=0:w=iw:h=300:color=black@0.30:t=fill,drawtext=fontfile=$FONT:text='PREVIEW. LICENSE. MOVE.':fontcolor=white:fontsize=54:x=70:y=92:shadowcolor=black@0.7:shadowx=2:shadowy=2" -an -c:v libx264 -pix_fmt yuv420p -r 30 /home/ubuntu/beatbox/seg3.mp4

ffmpeg -y -loop 1 -i "$PHONE" -t 6 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0018,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=180:s=1080x1920:fps=30,drawbox=x=0:y=0:w=iw:h=360:color=black@0.36:t=fill,drawtext=fontfile=$FONT:text='BUILT FOR CREATORS':fontcolor=white:fontsize=56:x=70:y=90:shadowcolor=black@0.7:shadowx=2:shadowy=2,drawtext=fontfile=$FONT:text='BeatBox':fontcolor=0xF5C542:fontsize=88:x=70:y=180:shadowcolor=black@0.7:shadowx=2:shadowy=2" -an -c:v libx264 -pix_fmt yuv420p -r 30 /home/ubuntu/beatbox/seg4.mp4

# Prepare the generated opening shot and a final CTA segment.
ffmpeg -y -i "$CLIP1" -t 6 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,drawbox=x=0:y=0:w=iw:h=300:color=black@0.28:t=fill,drawtext=fontfile=$FONT:text='YOUR SOUND DESERVES MORE':fontcolor=white:fontsize=51:x=70:y=92:shadowcolor=black@0.7:shadowx=2:shadowy=2" -an -c:v libx264 -pix_fmt yuv420p -r 30 /home/ubuntu/beatbox/seg1.mp4

ffmpeg -y -loop 1 -i "$PRODUCER" -t 6 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0010,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=180:s=1080x1920:fps=30,drawbox=x=0:y=0:w=iw:h=1920:color=black@0.22:t=fill,drawbox=x=55:y=1320:w=970:h=420:color=black@0.64:t=fill,drawtext=fontfile=$FONT:text='LIBERIAS MUSIC MARKETPLACE':fontcolor=white:fontsize=48:x=95:y=1410:shadowcolor=black@0.8:shadowx=2:shadowy=2,drawtext=fontfile=$FONT:text='sastechorg-beatbox.vercel.app':fontcolor=0xF5C542:fontsize=38:x=95:y=1510:shadowcolor=black@0.8:shadowx=2:shadowy=2,drawtext=fontfile=$FONT:text='START TODAY':fontcolor=0xF5C542:fontsize=64:x=95:y=1620:shadowcolor=black@0.8:shadowx=2:shadowy=2" -an -c:v libx264 -pix_fmt yuv420p -r 30 /home/ubuntu/beatbox/seg5.mp4

printf "file '%s'\n" /home/ubuntu/beatbox/seg1.mp4 /home/ubuntu/beatbox/seg2.mp4 /home/ubuntu/beatbox/seg3.mp4 /home/ubuntu/beatbox/seg4.mp4 /home/ubuntu/beatbox/seg5.mp4 > /home/ubuntu/beatbox/concat.txt
ffmpeg -y -f concat -safe 0 -i /home/ubuntu/beatbox/concat.txt -c copy /home/ubuntu/beatbox/beatbox_ad_video_only.mp4

ffmpeg -y -i /home/ubuntu/beatbox/beatbox_ad_video_only.mp4 -i "$BGM" -i "$VO" -filter_complex "[1:a]volume=0.24,aresample=48000[bgm];[2:a]volume=1.00,aresample=48000[vo];[vo][bgm]amix=inputs=2:duration=shortest:dropout_transition=1[a]" -map 0:v:0 -map '[a]' -t 30 -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart /home/ubuntu/beatbox/beatbox_ad_master_vertical.mp4

ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 /home/ubuntu/beatbox/beatbox_ad_master_vertical.mp4
