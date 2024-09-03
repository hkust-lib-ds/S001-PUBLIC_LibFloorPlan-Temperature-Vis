<?php

$id = $_GET['id'];
// echo "The ID value is: ".$id."<br>";

/*
$url = 'https://hkust.azure-api.net/sensor-data/_search';
$fields = array(
	// 'size' => 1,
	// 'sort' => '@timestamp:desc',
	'sort' => 'abs(now/millis-@timestamp):asc',
	'q' => 'zone:LIB AND ID:'.$id
);
 */

$url = 'https://hkust.azure-api.net/sensor-data/_search?q=zone:LIB+AND+ID:'.$id.'&sort=@timestamp:desc';

$headers = array(
    'X-Apim-Subscription-Key: <API Key>'
);

$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response = curl_exec($ch);

if($response === false) {
    echo 'Error: ' . curl_error($ch);
    echo 'Error code: ' . curl_errno($ch);
} else {
    echo $response;
}

curl_close($ch);

?>
