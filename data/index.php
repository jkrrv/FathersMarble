<?php

if (!isset($_GET['v'])) {
	die();
}

$villages = explode(',', strtoupper($_GET['v']));

echo "{";
$first = true;
foreach ($villages as $v) {
	$filename = "v/" . $v . ".json";

	if (!file_exists($filename))
		continue;

	if (!$first)
		echo ",";

	echo "\"" . $v . "\":";

	include $filename;

	$first = false;

}
echo "}";

