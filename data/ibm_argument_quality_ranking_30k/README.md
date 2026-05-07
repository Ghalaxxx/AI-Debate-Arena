---
license: cc-by-3.0
task_categories:
- text-classification
language:
- en
pretty_name: Argument-Quality-Ranking-30k
size_categories:
- 10K<n<100K
configs:
- config_name: argument_quality_ranking
  data_files:
  - split: train
    path: "train.csv"
  - split: validation
    path: "dev.csv"
  - split: test
    path: "test.csv"
- config_name: argument_topic
  data_files:
  - split: train
    path: "train_topic.csv"
  - split: validation
    path: "dev_topic.csv"
  - split: test
    path: "test_topic.csv"
---

# Dataset Card for Argument-Quality-Ranking-30k Dataset

## Table of Contents

- [Dataset Summary](#dataset-summary)
  - [Argument Quality Ranking](#argument-quality-ranking)
  - [Argument Topic](#argument-topic)
- [Dataset Collection](#dataset-collection)
  - [Argument Collection](#argument-collection)
  - [Quality and Stance Labeling](#quality-and-stance-labeling)
- [Dataset Structure](#dataset-structure)
  - [Quality Labels](#quality-labels)
  - [Stance Labels](#stance-labels)
- [Licensing Information](#licensing-information)
- [Citation Information](#citation-information)

## Dataset Summary

### Argument Quality Ranking

The dataset contains 30,497 crowd-sourced arguments for 71 debatable topics labeled for quality and stance, split into train, validation and test sets.

The dataset was originally published as part of our paper: [A Large-scale Dataset for Argument Quality Ranking: Construction and Analysis](https://arxiv.org/abs/1911.11408).

### Argument Topic

This subset contains 9,487 of the arguments only with their topics with a different train-validation-test split. Usage of this subset TBA.

## Dataset Collection

### Argument Collection

For the purpose of collecting arguments for this dataset we conducted a crowd annotation task. We selected 71 common controversial topics for which arguments were collected (e.g., We should abolish capital punishment).
Annotators were presented with a single topic each time, and asked to contribute one supporting and one contesting argument for it, requiring arguments to be written using original language. To motivate high-quality contributions, contributors were informed they will receive extra payment for high quality arguments, as determined by the subsequent argument quality labeling task.
It was explained that an argument will be considered as a high quality one, if a person preparing a speech on the topic will be likely to use this argument as is in her speech.
We place a limit on argument length - a minimum of 35 characters and a maximum of 210 characters. In total, we collected 30,497 arguments from 280 contributors, each contributing no more than 6 arguments per topic.

### Quality and Stance Labeling

Annotators were presented with a binary question per argument, asking if they would recommend a friend to use that argument as is in a speech supporting/contesting the topic, regardless of personal opinion. 
In addition, annotators were asked to mark the stance of the argument towards the topic (pro or con).
10 annotators labeled each instance.

## Dataset Structure

Each instance contains a string argument, a string topic, and quality and stance scores:
* WA - the quality label according to the weighted-average scoring function
* MACE-P - the quality label according to the MACE-P scoring function
* stance_WA - the stance label according to the weighted-average scoring function
* stance_WA_conf - the confidence in the stance label according to the weighted-average scoring function

### Quality Labels

For an explanation of the quality labels presented in columns WA and MACE-P, please see section 4 in the paper.

### Stance Labels

There were three possible annotations for the stance task: 1 (pro), -1 (con) and 0 (neutral). The stance_WA_conf column refers to the weighted-average score of the winning label. The stance_WA column refers to the winning stance label itself.

## Licensing Information

The datasets are released under the following licensing and copyright terms:
* (c) Copyright [Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Copyrights#Reusers.27_rights_and_obligations)
* (c) Copyright IBM 2014. Released under [CC-BY-SA 3.0](http://creativecommons.org/licenses/by-sa/3.0/)

## Citation Information

```
@article{DBLP:journals/corr/abs-1911-11408,
  author       = {Shai Gretz and
                  Roni Friedman and
                  Edo Cohen{-}Karlik and
                  Assaf Toledo and
                  Dan Lahav and
                  Ranit Aharonov and
                  Noam Slonim},
  title        = {A Large-scale Dataset for Argument Quality Ranking: Construction and
                  Analysis},
  journal      = {CoRR},
  volume       = {abs/1911.11408},
  year         = {2019},
  url          = {http://arxiv.org/abs/1911.11408},
  eprinttype    = {arXiv},
  eprint       = {1911.11408},
  timestamp    = {Tue, 03 Dec 2019 20:41:07 +0100},
  biburl       = {https://dblp.org/rec/journals/corr/abs-1911-11408.bib},
  bibsource    = {dblp computer science bibliography, https://dblp.org}
}
```