# 토로 3D

제공된 `toro-inoue/source/Toro Inoue.zip`의 모델과 얼굴 텍스처를 사용하는 정적 3D 뷰어입니다. 화면에는 모델, 16가지 표정 버튼, 애니메이션 버튼이 표시됩니다.

## 실행

Node.js 22 이상을 사용합니다.

```sh
npm ci
npm run dev
```

로컬 주소는 `http://127.0.0.1:4173/toro/`입니다. 수정 후 `npm run build`를 다시 실행하고 브라우저를 새로고침합니다.

## 빌드와 게시

```sh
npm run build
npm run preview
```

`scripts/export-model.mjs`는 제공된 `ToroHigh fixed.dae`와 텍스처를 GLB로 변환합니다. 원본의 7개 메시, 18개 뼈대, UV와 16개 표정을 보존합니다. 원본에서 사용하지 않는 정점 색상 속성은 GLB 로딩 시 잘못 적용되지 않도록 제외합니다.

`scripts/build.mjs`는 GitHub Pages용 정적 파일을 `docs/`에 생성합니다. 게시 설정은 `codex/toro-3d` 브랜치의 `/docs` 경로를 사용합니다. 상대 경로로 로딩하므로 `/toro/` 아래에서도 모델과 텍스처가 작동합니다.

## 조작

- 드래그 또는 터치로 회전, 스크롤 또는 두 손가락으로 확대·축소
- 표정 버튼으로 원본 텍스처 시트의 16가지 표정 선택
- 기본, 인사, 춤추기 애니메이션 전환
- 모델에 키보드 포커스를 둔 상태에서 방향키로 회전, `R`로 시점 초기화

애니메이션은 제공된 뼈대를 이용해 이 뷰어에서 구현했습니다. 모션 감소 설정에서는 각 자세를 정지 상태로 표시합니다.

## 자료

모델과 텍스처는 사용자가 제공한 파일입니다. 비공식 팬 프로젝트이며 캐릭터 권리는 Sony Interactive Entertainment Inc.에 있습니다.

[캐릭터 소개 — 비사이드](https://prtimes.jp/main/html/rd/p/000000073.000104705.html)

[보안 및 배포 범위](SECURITY.md)
