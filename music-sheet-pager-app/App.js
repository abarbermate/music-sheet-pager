import React, { useRef, useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator } from 'react-native-paper';
import { AppState, Text, View, TouchableOpacity, Alert, Image } from 'react-native'
import { Camera } from 'expo-camera'
import PagerView from 'react-native-pager-view';
import * as FaceDetector from 'expo-face-detector';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

let camera

export default function App() {
	const appState = useRef(AppState.currentState)
	const pagerRef = useRef()
	const [isLoading, setIsLoading] = useState(false);
	const [images, setImages] = useState([]);
	const [appStateVisible, setAppStateVisible] = useState(appState.current)
	const [cameraTest, setCameraTest] = useState(false)
	const [startCamera, setStartCamera] = useState(false)
	const [tilt, setTilt] = useState("CENTER")
	const [currentPage, setCurrentPage] = useState(0)
	const [noseBase, setNoseBase] = useState({ "x": 0, "y": 0 })
	const [leftMouth, setLeftMouth] = useState({ "x": 0, "y": 0 })
	const [rightMouth, setRightMouth] = useState({ "x": 0, "y": 0 })
	const [bottomMouth, setBottomMouth] = useState({ "x": 0, "y": 0 })
	const [leftCheek, setLeftCheek] = useState({ "x": 0, "y": 0 })
	const [rightCheek, setRightCheek] = useState({ "x": 0, "y": 0 })
	const [leftEye, setLeftEye] = useState({ "x": 0, "y": 0 })
	const [rightEye, setRightEye] = useState({ "x": 0, "y": 0 })

	useEffect(() => {
		const subscription = AppState.addEventListener("change", nextAppState => {
			if (
				!appState.current.match(/inactive|background/) &&
				nextAppState !== "active"
			) {
				setStartCamera(false)
			}
			if (
				appState.current.match(/inactive|background/) &&
				nextAppState === "active"
			) {
				//setCurrentPage(0)
				setStartCamera(true)
			}

			appState.current = nextAppState;
			setAppStateVisible(appState.current);
			console.log("AppState", appState.current);
		});

		return () => {
			subscription.remove();
		};
	}, []);

	const handleFacesDetected = ({ faces }) => {
		if (faces && faces.length > 0) {
			setNoseBase(faces[0].NOSE_BASE)
			setLeftMouth(faces[0].LEFT_MOUTH)
			setRightMouth(faces[0].RIGHT_MOUTH)
			setBottomMouth(faces[0].BOTTOM_MOUTH)
			setLeftCheek(faces[0].LEFT_CHEEK)
			setRightCheek(faces[0].RIGHT_CHEEK)
			setLeftEye(faces[0].LEFT_EYE)
			setRightEye(faces[0].RIGHT_EYE)

			const leftCheek = faces[0].LEFT_CHEEK
			const rightCheek = faces[0].RIGHT_CHEEK

			const treshold = cameraTest ? 45 : 25

			if (leftCheek && rightCheek) {
				//console.log("left:", Math.round(leftCheek.y / treshold), "right:", Math.round(rightCheek.y / treshold))

				if (Math.round(leftCheek.y / treshold) < Math.round(rightCheek.y / treshold)) {
					if (tilt !== "LEFT") {
						pagerRef.current.setPage(currentPage - 1)
						setCurrentPage((currentPage > 0) ? currentPage - 1 : currentPage)
						setTilt("LEFT")
					}
				}
				else if (Math.round(leftCheek.y / treshold) > Math.round(rightCheek.y / treshold)) {
					if (tilt !== "RIGHT") {
						pagerRef.current.setPage(currentPage + 1)
						setCurrentPage((currentPage < images.length - 1) ? currentPage + 1 : currentPage)
						setTilt("RIGHT")
					}
				}
				else {
					setTilt("CENTER")
				}
			}
			else {
				setTilt("CENTER")
			}
		}
	};

	const toBase64 = async (file) => {
		const res = await FileSystem.readAsStringAsync(file, { encoding: FileSystem.EncodingType.Base64 });
		return res
	};

	const startTheCamera = async () => {
		const { status } = await Camera.requestCameraPermissionsAsync()
		console.log(status)
		if (status === 'granted') {
			setStartCamera(true)
		} else {
			Alert.alert('Access denied')
		}
	}

	const closeTheCamera = async () => {
		setStartCamera(false)
	}

	const pickDocument = async () => {
		let result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/binary'] });
		setIsLoading(true)
		fetch("https://us-central1-pdf-to-png-98491.cloudfunctions.net/convertPDFtoPNG/pdf-to-png", {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				data: (result.uri.includes('file:///')) ? await toBase64(result.uri) : result.uri,
				filename: result.name
			})
		})
			.then(data => data.json())
			.then(json => {
				setImages(json)
				setIsLoading(false)
				setCurrentPage(0)
				startTheCamera()
			})
			.catch(e => {
				console.log("error:", e)
				setIsLoading(false)
			})
	}

	const startWithDefault = () => {
		setImages([
			"https://abarbermate.web.elte.hu/test_kotta_1.jpg",
			"https://abarbermate.web.elte.hu/test_kotta_2.jpg",
			"https://abarbermate.web.elte.hu/test_kotta_3.jpg",
			"https://abarbermate.web.elte.hu/test_kotta_4.jpg",
			"https://abarbermate.web.elte.hu/test_kotta_5.jpg",
		])
		setCurrentPage(0)
		startTheCamera()
	}

	return (
		<View style={{
			flex: 1,
			backgroundColor: '#efefef',
			alignItems: 'center',
			justifyContent: 'center',
			gap: 32,
		}}>
			{isLoading
				? <ActivityIndicator animating={true} />
				: (startCamera ? (
					<View
						style={{
							flex: 1,
							width: '100%',
							paddingLeft: 16,
							paddingRight: 16,
						}}
					>
						<View style={{ flexDirection: cameraTest ? 'column-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
							<TouchableOpacity
								onPress={() => { setCameraTest(false); closeTheCamera() }}
								style={{
									width: 130,
									borderRadius: 4,
									backgroundColor: '#14274e',
									justifyContent: 'center',
									alignItems: 'center',
									height: 40,
									marginTop: cameraTest ? 24 : 0
								}}
							>
								<Text
									style={{
										color: '#fff',
										fontWeight: 'bold',
										textAlign: 'center'
									}}
								>
									Vissza
								</Text>
							</TouchableOpacity>
							{cameraTest && <Text
								style={{
									fontWeight: 'bold',
									textAlign: 'center'
								}}
							>
								{tilt}
							</Text>}
							<Camera
								type={Camera.Constants.Type.front}
								style={{
									position: 'relative',
									width: cameraTest ? 412 : 150,
									height: cameraTest ? 549 : 200,
									marginTop: 24,
									opacity: cameraTest ? 1 : 1
								}}
								ref={(r) => {
									camera = r
								}}
								onFacesDetected={handleFacesDetected}
								faceDetectorSettings={{
									mode: FaceDetector.FaceDetectorMode.accurate,
									detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
									runClassifications: FaceDetector.FaceDetectorClassifications.none,
									minDetectionInterval: cameraTest ? 250 : 250,
									tracking: true,
								}}
							>
								{cameraTest ?
									<>
										<View style={{
											position: 'absolute',
											top: noseBase ? noseBase.y : 0,
											left: noseBase ? noseBase.x : 0,
											width: 10,
											height: 10,
											backgroundColor: 'red',
											borderRadius: 5,
										}} />
										<View style={{
											position: 'absolute',
											top: leftEye ? leftEye.y : 0,
											left: leftEye ? leftEye.x : 0,
											width: 10,
											height: 10,
											backgroundColor: 'red',
											borderRadius: 5,
										}} />
										<View style={{
											position: 'absolute',
											top: rightEye ? rightEye.y : 0,
											left: rightEye ? rightEye.x : 0,
											width: 10,
											height: 10,
											backgroundColor: 'red',
											borderRadius: 5,
										}} />
										<View style={{
											position: 'absolute',
											top: leftCheek ? leftCheek.y : 0,
											left: leftCheek ? leftCheek.x : 0,
											width: 10,
											height: 10,
											backgroundColor: 'red',
											borderRadius: 5,
										}} />
										<View style={{
											position: 'absolute',
											top: rightCheek ? rightCheek.y : 0,
											left: rightCheek ? rightCheek.x : 0,
											width: 10,
											height: 10,
											backgroundColor: 'red',
											borderRadius: 5,
										}} />
										<View style={{
											position: 'absolute',
											top: bottomMouth ? bottomMouth.y : 0,
											left: bottomMouth ? bottomMouth.x : 0,
											width: 10,
											height: 10,
											backgroundColor: 'red',
											borderRadius: 5,
										}} />
										<View style={{
											position: 'absolute',
											top: leftMouth ? leftMouth.y : 0,
											left: leftMouth ? leftMouth.x : 0,
											width: 10,
											height: 10,
											backgroundColor: 'red',
											borderRadius: 5,
										}} />
										<View style={{
											position: 'absolute',
											top: rightMouth ? rightMouth.y : 0,
											left: rightMouth ? rightMouth.x : 0,
											width: 10,
											height: 10,
											backgroundColor: 'red',
											borderRadius: 5,
										}} />
									</>
									: null
								}
							</Camera>
						</View>
						<PagerView ref={pagerRef} style={{ flex: 1, marginLeft: -16, marginRight: -16 }} initialPage={0} scrollEnabled={false}>
							{images && images.map((image, ind) => {
								return <View style={{ justifyContent: 'center', alignItems: 'center' }} key={ind}>
									<Image
										style={{ width: "100%", height: "100%" }}
										resizeMode={'contain'}
										source={{
											uri: image,
										}}
									/>
								</View>
							})}
						</PagerView>
					</View>
				) : (
					<View
						style={{
							flex: 1,
							justifyContent: 'center',
							alignItems: 'center',
						}}
					>
						<TouchableOpacity
							onPress={pickDocument}
							style={{
								width: 250,
								borderRadius: 4,
								backgroundColor: '#14274e',
								flexDirection: 'row',
								justifyContent: 'center',
								alignItems: 'center',
								height: 50,
								marginBottom: 25,
							}}
						>
							<Text
								style={{
									color: '#fff',
									fontWeight: 'bold',
									textAlign: 'center'
								}}
							>
								Fájl megnyitása
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							onPress={startWithDefault}
							style={{
								width: 250,
								borderRadius: 4,
								backgroundColor: '#14274e',
								flexDirection: 'row',
								justifyContent: 'center',
								alignItems: 'center',
								height: 50,
								marginBottom: 25,
							}}
						>
							<Text
								style={{
									color: '#fff',
									fontWeight: 'bold',
									textAlign: 'center'
								}}
							>
								Kotta lapozás demo
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							onPress={() => { setCameraTest(true); startWithDefault() }}
							style={{
								width: 250,
								borderRadius: 4,
								backgroundColor: '#14274e',
								flexDirection: 'row',
								justifyContent: 'center',
								alignItems: 'center',
								height: 50
							}}
						>
							<Text
								style={{
									color: '#fff',
									fontWeight: 'bold',
									textAlign: 'center'
								}}
							>
								Arc felismerés ellenörzése
							</Text>
						</TouchableOpacity>
					</View>
				))}
			<StatusBar style="auto" />
		</View>
	)
}