for x in $(fdfind -t f); do ext="${x##*.}"; echo $'\n\n\n## '$x$'\n'; echo '```'$ext; cat $x; echo '```'; done
